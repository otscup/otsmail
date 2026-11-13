<template>
  <div class="content-box" ref="contentBox">
    <div ref="container" class="content-html" :class="{ 'is-dark': isDark }"></div>
  </div>
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount, onUpdated, watch } from 'vue'
import DOMPurify from 'dompurify'

const props = defineProps({
  html: {
    type: String,
    required: true
  }
})

const container = ref(null)
const contentBox = ref(null)
let shadowRoot = null
const isDark = ref(false)
let themeObserver = null

// 邮件正文是完全不可信的输入（任何人给你的地址发一封邮件就能投递 HTML）。
// Shadow DOM 只隔离样式，不是安全边界 —— 脚本照样在主页面上下文执行。
// 因此正文必须先经 DOMPurify 消毒再插入。
//
// 消毒策略：
//  - 禁止 script / iframe / object / embed / form 等可执行或可钓鱼的标签
//  - 禁止所有 on* 事件属性（DOMPurify 默认行为）
//  - 只允许 http / https / mailto / cid / data:image 这几类 URL，
//    显式挡掉 javascript: 与 data:text/html
//  - 外链统一加 target=_blank + rel=noopener noreferrer，避免 tabnabbing
DOMPurify.addHook('afterSanitizeAttributes', (node) => {
  if (node.tagName === 'A') {
    node.setAttribute('target', '_blank')
    node.setAttribute('rel', 'noopener noreferrer')
  }
  // 邮件里的 style/color 经常把白色文字写死；主题色必须优先。
  // 同时剔除 position:fixed/sticky，避免正文把固定定位元素盖到整个应用界面上。
  if (node.hasAttribute('style')) {
    const cleaned = node.getAttribute('style')
      .replace(/(?:^|;)\s*(?:color|background(?:-color|-image)?)\s*:[^;]*/gi, '')
      .replace(/(?:^|;)\s*position\s*:\s*(?:fixed|sticky)\b[^;]*/gi, '')
      .replace(/expression\s*\(/gi, 'none(')
      .trim()
    if (cleaned) node.setAttribute('style', cleaned)
    else node.removeAttribute('style')
  }
  node.removeAttribute('bgcolor')
  if (node.tagName === 'FONT') node.removeAttribute('color')
})

const PURIFY_CONFIG = {
  // style 整体禁用：@import / url() 会外发请求，:host 规则还能改写宿主、覆盖整个应用
  FORBID_TAGS: ['script', 'style', 'iframe', 'object', 'embed', 'form', 'input', 'button',
                'textarea', 'select', 'base', 'link', 'meta'],
  FORBID_ATTR: ['srcdoc', 'formaction', 'ping'],
  ALLOWED_URI_REGEXP: /^(?:(?:https?|mailto|cid|tel):|data:image\/(?:png|jpe?g|gif|webp|bmp|svg\+xml);base64,|[^a-z]|[a-z+.\-]+(?:[^a-z+.\-:]|$))/i,
  ALLOW_DATA_ATTR: false,
  KEEP_CONTENT: true
}

// <body style="..."> 的内容会被拼进我们的 <style> 里，未经处理时可以用
// `}` 提前闭合选择器并注入任意 CSS 规则（界面伪装 / 内容遮挡）。
// 这里只保留一段单纯的声明串，剔除会改变 CSS 结构的字符。
function sanitizeInlineStyle(style) {
  if (!style) return ''
  return style
    .replace(/[<>{}@;]/g, ' ')
    .replace(/(?:^|\s)(?:color|background(?:-color|-image)?)\s*:[^;]*/gi, '')
    .replace(/(?:^|\s)position\s*:\s*(?:fixed|sticky)\b[^;]*/gi, '')
    .replace(/url\s*\(/gi, 'none(')
    .replace(/expression\s*\(/gi, 'none(')
    .slice(0, 500)
}

function updateContent() {
  if (!shadowRoot) return;

  // 1. 提取 <body> 的 style 属性（如果存在）
  const bodyStyleRegex = /<body[^>]*style="([^"]*)"[^>]*>/i;
  const bodyStyleMatch = props.html.match(bodyStyleRegex);
  const bodyStyle = sanitizeInlineStyle(bodyStyleMatch ? bodyStyleMatch[1] : '');

  // 2. 移除 <body> 标签（保留内容）
  const strippedHtml = props.html.replace(/<\/?body[^>]*>/gi, '');

  // 3. 消毒正文
  const cleanedHtml = DOMPurify.sanitize(strippedHtml, PURIFY_CONFIG);

  // 4. 将 body 的 style 应用到 .shadow-content
  shadowRoot.innerHTML = `
    <style>
      :host {
        all: initial;
        width: 100%;
        height: 100%;
        /* 建立包含块：即使正文里有 position:fixed，也被限制在阅读区内，盖不住应用界面 */
        transform: translateZ(0);
        font-family: -apple-system, Inter, BlinkMacSystemFont,
                    'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
        font-size: 15px;
        line-height: 1.7;
        color: #13181D;
        word-break: break-word;
      }

      h1, h2, h3, h4 {
          font-size: 18px;
          font-weight: 700;
      }

      p {
        margin: 0;
      }

      a {
        text-decoration: none;
        color: #0E70DF;
      }

      :host(.is-dark) {
        color: #E5E7EB;
      }

      :host(.is-dark) .shadow-content {
        background: transparent !important;
        color: var(--rd-text, #E5E7EB) !important;
      }

      :host(.is-dark) .shadow-content * {
        color: var(--rd-text, #E5E7EB) !important;
        background-color: transparent !important;
        border-color: rgba(148, 163, 184, .28) !important;
      }

      :host(.is-dark) a {
        color: var(--rd-accent, #67E8F9) !important;
      }

      .shadow-content {
        background: transparent !important;
        color: var(--rd-text, #13181D) !important;
        width: fit-content;
        height: fit-content;
        min-width: 100%;
        ${bodyStyle ? bodyStyle : ''} /* 注入 body 的 style */
      }

      /* 邮件自带的白色/浅色文字在白底或皮肤深色底上都要服从当前主题。 */
      .shadow-content *:not(a) {
        color: var(--rd-text, #13181D) !important;
        background-color: transparent !important;
      }

      .shadow-content a {
        color: var(--rd-accent, #2454d6) !important;
      }

      :host(.is-dark) .shadow-content {
        background: transparent !important;
        color: var(--rd-text, #E5E7EB) !important;
      }

      img:not(table img) {
        max-width: 100%;
        height: auto !important;
      }

    </style>
    <div class="shadow-content">
      ${cleanedHtml}
    </div>
  `;
}

function autoScale() {
  if (!shadowRoot || !contentBox.value) return

  const parent = contentBox.value
  const shadowContent = shadowRoot.querySelector('.shadow-content')

  if (!shadowContent) return

  const parentWidth = parent.offsetWidth
  const childWidth = shadowContent.scrollWidth

  if (childWidth === 0) return

  const scale = parentWidth / childWidth

  const hostElement = shadowRoot.host
  hostElement.style.zoom = scale
}

function ensureShadow() {
  if (!container.value) return
  if (!container.value.shadowRoot) shadowRoot = container.value.attachShadow({ mode: 'open' })
}

onMounted(() => {
  isDark.value = document.documentElement.dataset.theme === 'dark'
  themeObserver = new MutationObserver(() => { isDark.value = document.documentElement.dataset.theme === 'dark' })
  themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] })
  ensureShadow()
  updateContent()
  autoScale()
})

onBeforeUnmount(() => themeObserver?.disconnect())

onUpdated(() => {
  // Vue may replace the host node; only rebuild if the shadow root was lost.
  if (!container.value?.shadowRoot) {
    ensureShadow()
    updateContent()
    autoScale()
  }
})

watch(() => props.html, () => {
  updateContent()
  autoScale()
})
</script>

<style scoped>
.content-box {
  width: 100%;
  height: 100%;
  overflow: hidden;
  font-family: -apple-system, Inter, BlinkMacSystemFont, "Segoe UI", "Noto Sans", Helvetica, Arial, sans-serif, "Apple Color Emoji", "Segoe UI Emoji";
}

.content-html {
  width: 100%;
  height: 100%;
}
</style>
