<template>
  <div class="ai-assistant" :class="{ 'is-inline': inline }">
    <button class="ai-fab" type="button" :aria-label="t('aiAssistant')" :title="t('aiAssistant')" @click="togglePanel">
      <svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor" aria-hidden="true"><path d="M12 1.5l2.55 7.95L22.5 12l-7.95 2.55L12 22.5l-2.55-7.95L1.5 12l7.95-2.55z"/></svg>
    </button>
    <Teleport to="body">
      <button v-if="minimized && !open" class="ai-mini-bubble" type="button" :aria-label="t('aiAssistant')" @click="restorePanel">
        <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor" aria-hidden="true"><path d="M12 1.5l2.55 7.95L22.5 12l-7.95 2.55L12 22.5l-2.55-7.95L1.5 12l7.95-2.55z"/></svg>
      </button>
    </Teleport>

    <Teleport to="body">
      <div v-if="open" class="ai-chat-backdrop" :style="chatBackdropStyle" @click.self="closePanel"></div>
      <Transition :css="false" @enter="enterPanel" @leave="leavePanel">
        <section v-if="open" class="ai-panel" role="dialog" :aria-label="t('aiAssistant')">
          <header class="ai-header">
            <div class="ai-brand">
              <span class="ai-mark">
                <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor" aria-hidden="true"><path d="M12 1.5l2.55 7.95L22.5 12l-7.95 2.55L12 22.5l-2.55-7.95L1.5 12l7.95-2.55z"/></svg>
              </span>
              <div class="ai-heading">
                <span class="ai-title">{{ t('aiAssistant') }}</span>
                <span class="ai-subtitle">{{ t('aiSubtitle') }}</span>
              </div>
            </div>
            <div class="ai-header-actions">
              <button class="ai-min" type="button" :aria-label="t('aiMinimize')" @click="minimizePanel">–</button>
              <button class="ai-close" type="button" :aria-label="t('aiClose')" @click="closePanel">✕</button>
            </div>
          </header>

      <div class="ai-body" ref="bodyRef">
        <div class="ai-context" v-if="activeEmailId">
          <span>{{ t('aiWorkingOn') }}</span>
          <strong>{{ activeEmailSubject || ('#' + activeEmailId) }}</strong>
        </div>
        <div class="ai-card" v-if="activeEmailId || panelText">
          <button v-if="activeEmailId" class="ai-action" type="button" :disabled="busy" @click="summarizeActive">
            {{ t('aiSummary') }}
          </button>
          <button v-if="activeEmailId" class="ai-action" type="button" :disabled="busy" @click="doReply">
            {{ t('aiReply') }}
          </button>
          <button v-if="panelText" class="ai-action" type="button" :disabled="busy" @click="doPolish">
            {{ t('aiPolish') }}
          </button>
        </div>

        <div class="ai-card" v-if="draft">
          <div class="ai-card-subject" v-if="draft.subject">{{ draft.subject }}</div>
          <pre class="ai-card-text">{{ draft.text }}</pre>
          <button class="ai-fill" type="button" @click="fillDraft">{{ t('aiFill') }}</button>
        </div>

        <div class="ai-messages">
          <div v-for="(message, index) in messages" :key="index" class="ai-msg" :class="message.role">
            <div class="ai-bubble">{{ message.text }}</div>
            <ul class="ai-actions" v-if="message.actions && message.actions.length">
              <li v-for="(action, i) in message.actions" :key="i" :class="action.ok ? 'ok' : 'fail'">
                {{ action.ok ? '✓' : '✗' }} {{ action.type }}
                <template v-if="action.to"> {{ action.to }}</template>
                <template v-else-if="action.emailId"> #{{ action.emailId }}</template>
                <span v-if="!action.ok">· {{ action.error }}</span>
              </li>
            </ul>
          </div>
          <div class="ai-msg ai" v-if="busy">
            <div class="ai-bubble ai-bubble--muted">{{ t('aiThinking') }}</div>
          </div>
        </div>
      </div>

      <footer class="ai-footer">
        <textarea
            v-model="input"
            class="ai-input"
            rows="2"
            :placeholder="t('aiCommandPlaceholder')"
            :aria-label="t('aiCommand')"
            @keydown.enter.exact.prevent="send"/>
        <button class="ai-send" type="button" :disabled="busy || !input.trim()" @click="send">
          {{ t('send') }}
        </button>
          </footer>
        </section>
      </Transition>
    </Teleport>
  </div>
</template>

<script setup>
import {computed, nextTick, onMounted, onUnmounted, ref, watch} from 'vue'
import {useI18n} from 'vue-i18n'
import {Icon} from '@iconify/vue'
import {ElMessage} from 'element-plus'
import {aiCommand, aiPolish, aiReply, aiSummary} from '@/request/ai.js'
import {useEmailStore} from '@/store/email.js'
import {useAccountStore} from '@/store/account.js'
import {useSettingStore} from '@/store/setting.js'
import {cvtR2Url} from '@/utils/convert.js'

const props = defineProps({
  // 邮件详情页传当前邮件 id；写信页可不传
  emailId: {type: [Number, String], default: 0},
  emailSubject: {type: String, default: ''},
  // 待润色的正文（写信框内容 / 邮件纯文本）
  text: {type: String, default: ''},
  tone: {type: String, default: ''},
  inline: {type: Boolean, default: false},
  reader: {type: Boolean, default: false},
})

const emit = defineEmits(['fill'])

const {t} = useI18n()
const open = ref(false)
const minimized = ref(false)
const emailStore = useEmailStore()
const activeEmailId = ref(props.emailId)
const activeEmailSubject = ref(props.emailSubject)
const panelText = ref(props.text)
function openPanel(emailId = 0, subject = '', draftText = '') {
  if (!emailId) {
    const current = emailStore.contentData?.email
    if (current?.emailId) {
      emailId = current.emailId
      subject = subject || current.subject || ''
    }
  }
  if (emailId) {
    activeEmailId.value = emailId
    activeEmailSubject.value = subject || ''
  }
  panelText.value = draftText || ''
  minimized.value = false
  open.value = true
}
function minimizePanel() {
  open.value = false
  minimized.value = true
  document.body.classList.remove('compose-ai-open')
}
function closePanel() {
  open.value = false
  minimized.value = false
  document.body.classList.remove('compose-ai-open')
}
function restorePanel() {
  minimized.value = false
  open.value = true
}
function togglePanel() {
  if (!open.value) {
    const current = emailStore.contentData?.email
    activeEmailId.value = props.emailId || current?.emailId || 0
    activeEmailSubject.value = props.emailSubject || current?.subject || ''
    panelText.value = props.text
    minimized.value = false
  }
  open.value = !open.value
}
watch(() => props.emailId, value => { if (value) activeEmailId.value = value })
watch(() => emailStore.contentData?.email?.emailId, value => {
  if (value) {
    activeEmailId.value = value
    activeEmailSubject.value = emailStore.contentData?.email?.subject || ''
  }
})
function onComposeAi(event) {
  if (!props.inline || props.reader) return
  const detail = event.detail || {}
  const current = emailStore.contentData?.email
  activeEmailId.value = Number(detail.emailId) || current?.emailId || 0
  activeEmailSubject.value = detail.subject || current?.subject || ''
  panelText.value = detail.text || ''
  minimized.value = false
  open.value = true
  document.body.classList.add('compose-ai-open')
}
watch(() => props.emailSubject, value => { activeEmailSubject.value = value })
let panelAnim = null
const panelReduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)')

function enterPanel(el, done) {
  if (panelReduceMotion.matches || !el.animate) return done()
  if (panelAnim) panelAnim.cancel()
  el.style.opacity = '0'
  el.style.transform = 'translateY(18px) scale(.965)'
  panelAnim = el.animate([
    {opacity: 0, transform: 'translateY(18px) scale(.965)'},
    {opacity: 1, transform: 'translateY(0) scale(1)'},
  ], {duration: 340, easing: 'cubic-bezier(.22,1.18,.36,1)', fill: 'both'})
  panelAnim.onfinish = () => {
    el.style.opacity = ''
    el.style.transform = ''
    panelAnim = null
    done()
  }
}

function leavePanel(el, done) {
  if (panelReduceMotion.matches || !el.animate) return done()
  const current = getComputedStyle(el)
  const from = {opacity: current.opacity, transform: current.transform}
  if (panelAnim) panelAnim.cancel()
  panelAnim = el.animate([
    from,
    {opacity: 0, transform: 'translateY(18px) scale(.965)'},
  ], {duration: 220, easing: 'cubic-bezier(.4,0,1,1)', fill: 'both'})
  panelAnim.onfinish = () => {
    panelAnim = null
    done()
  }
}

defineExpose({ openPanel })
const busy = ref(false)
const draft = ref(null)
const messages = ref([])
const input = ref('')
const bodyRef = ref(null)
const CHAT_KEY = 'otsmail.ai.chat'
try {
  const saved = JSON.parse(localStorage.getItem(CHAT_KEY) || '[]')
  if (Array.isArray(saved)) messages.value = saved
} catch (e) {
  messages.value = []
}
watch(messages, value => {
  try {
    localStorage.setItem(CHAT_KEY, JSON.stringify(value.slice(-40)))
  } catch (e) {
    // 隐私模式/配额满时不影响聊天
  }
}, {deep: true})
const settingStore = useSettingStore()
// 背景铺满整个视口（含侧边栏）；面板半透明，图片从面板后面透出来
const chatPanelStyle = computed(() => {
  const background = settingStore.settings.chatBackground
  if (!background) return {}
  return {
    backgroundColor: 'transparent',
    '--ai-chat-bg': `url(${cvtR2Url(background)})`,
    '--ai-chat-opacity': String(Number(settingStore.settings.chatOpacity ?? 0.88))
  }
})
const chatBackdropStyle = computed(() => {
  const background = settingStore.settings.chatBackground
  if (!background) return {}
  return {
    backgroundColor: 'rgba(15, 23, 42, 0.16)'
  }
})

async function summarizeActive() {
  if (!activeEmailId.value) return
  busy.value = true
  try {
    const res = await aiSummary(activeEmailId.value, settingStore.lang === 'en' ? 'en' : 'zh')
    messages.value.push({role: 'ai', text: res?.summary || res?.text || t('aiFailed')})
    scrollToBottom()
  } catch (e) {
    messages.value.push({role: 'ai', text: e?.message || t('aiFailed')})
  } finally {
    busy.value = false
  }
}

async function doReply() {
  busy.value = true
  try {
    draft.value = await aiReply(activeEmailId.value, props.tone)
  } finally {
    busy.value = false
  }
}

async function doPolish() {
  busy.value = true
  try {
    const res = await aiPolish(panelText.value, '')
    draft.value = {subject: '', text: res.text}
  } finally {
    busy.value = false
  }
}

async function send() {
  const text = input.value.trim()
  if (!text || busy.value) return

  const history = messages.value.slice(-20).map(m => ({role: m.role === 'ai' ? 'assistant' : 'user', text: m.text}))
  messages.value.push({role: 'user', text})
  input.value = ''
  busy.value = true
  scrollToBottom()

  try {
    const res = await aiCommand(text, useAccountStore().currentAccountId, history, activeEmailId.value)
    messages.value.push({role: 'ai', text: res?.reply || '', actions: res?.actions || []})
    // 删除/已读等动作已落库，刷新背后的邮件列表，避免界面和数据不一致
    if (res?.actions?.some(action => action.ok)) {
      useEmailStore().emailScroll?.refreshList()
    }
  } catch (e) {
    // axios 拦截器已弹错误提示，这里只把原因留在对话里
    messages.value.push({role: 'ai', text: e?.message || t('aiFailed')})
  } finally {
    busy.value = false
    scrollToBottom()
  }
}

function fillDraft() {
  const text = draft.value?.text || ''
  emit('fill', {subject: draft.value?.subject || '', text})
  window.dispatchEvent(new CustomEvent('otsmail:ai-fill', {detail: {text, subject: draft.value?.subject || ''}}))
  ElMessage.success(t('aiFilled'))
  open.value = false
}

async function scrollToBottom() {
  await nextTick()
  if (bodyRef.value) {
    bodyRef.value.scrollTop = bodyRef.value.scrollHeight
  }
}

function onKeydown(event) {
  if (event.key === 'Escape' && open.value) {
    open.value = false
  }
}

watch(open, value => {
  if (value) {
    scrollToBottom()
  } else {
    document.body.classList.remove('compose-ai-open')
  }
})

onMounted(() => {
  window.addEventListener('keydown', onKeydown)
  window.addEventListener('otsmail:ai-compose', onComposeAi)
})
onUnmounted(() => {
  window.removeEventListener('keydown', onKeydown)
  window.removeEventListener('otsmail:ai-compose', onComposeAi)
})
</script>

<style scoped>
/* 不占文档流：AI 面板/按钮都是 fixed，打开时不能把页面内容挤动 */
.ai-assistant {
  display: contents;
}

.ai-assistant.is-inline {
  display: inline-flex;
}

.ai-assistant.is-inline .ai-fab {
  position: static;
  width: 34px;
  height: 34px;
  color: var(--label-2);
  background: transparent;
  box-shadow: none;
  transform: none;
}

.ai-assistant.is-inline .ai-fab:hover {
  color: var(--label);
  background: var(--fill-quaternary);
  box-shadow: none;
  transform: none;
}

.ai-fab {
  position: fixed;
  right: 24px;
  bottom: 24px;
  z-index: 2000;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 54px;
  height: 54px;
  border: none;
  border-radius: 50%;
  color: #fff;
  background: linear-gradient(145deg, #0a84ff, #0066d6);
  box-shadow: 0 8px 22px rgba(0, 122, 255, .28);
  cursor: pointer;
  transition: transform .2s cubic-bezier(.2, .8, .2, 1), box-shadow .2s ease;
}

.ai-fab:hover {
  transform: translateY(-2px) scale(1.03);
  box-shadow: 0 10px 26px rgba(0, 122, 255, .34);
}

.ai-fab:active {
  transform: scale(.94);
  box-shadow: 0 4px 12px rgba(0, 122, 255, .22);
}

.ai-chat-backdrop {
  position: fixed;
  inset: 0;
  z-index: 3000;
  background-position: center;
  background-size: cover;
  background-repeat: no-repeat;
  pointer-events: none;
  transition: opacity .3s ease;
}

.ai-panel {
  position: fixed;
  top: 12px;
  right: 12px;
  bottom: 12px;
  z-index: 3001;
  display: flex;
  flex-direction: column;
  width: min(420px, calc(100vw - 24px));
  border: 0.5px solid color-mix(in srgb, var(--separator, rgba(60, 60, 67, .29)) 70%, transparent);
  border-radius: 24px;
  overflow: hidden;
  background: color-mix(in srgb, var(--bg-secondary, #fff) 72%, var(--bg-grouped, #f2f2f7));
  backdrop-filter: blur(22px) saturate(180%);
  -webkit-backdrop-filter: blur(22px) saturate(180%);
  box-shadow: 0 24px 60px rgba(0, 0, 0, .18), 0 2px 8px rgba(0, 0, 0, .06);
  transform-origin: right center;
}

.ai-panel.has-chat-bg {
  background: transparent;
}

.ai-panel.has-chat-bg > .ai-chat-photo {
  position: absolute;
  inset: 0;
  z-index: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
  pointer-events: none;
}

.ai-panel.has-chat-bg::after {
  content: '';
  position: absolute;
  inset: 0;
  z-index: 0;
  background: rgba(255, 255, 255, .42);
  pointer-events: none;
}

.ai-panel.has-chat-bg > *:not(.ai-chat-photo) {
  position: relative;
  z-index: 1;
}

.ai-panel-enter-active,
.ai-panel-leave-active {
  transition: transform .3s cubic-bezier(.2, .8, .2, 1), opacity .24s ease;
}

.ai-panel-enter-from,
.ai-panel-leave-to {
  opacity: 0;
  transform: translateX(28px) scale(.985);
}

.ai-panel.has-chat-bg .ai-header,
.ai-panel.has-chat-bg .ai-footer {
  background: color-mix(in srgb, var(--bg-secondary, #fff) 36%, transparent);
}

.ai-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  min-height: 64px;
  padding: 10px 14px 10px 16px;
  border-bottom: 0.5px solid var(--separator, rgba(60, 60, 67, .29));
  background: color-mix(in srgb, var(--bg-secondary, #fff) 80%, transparent);
}

.ai-brand {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
}

.ai-mark {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  flex: 0 0 auto;
  border-radius: 50%;
  color: #fff;
  background: linear-gradient(135deg,#55d6ff,#7c7bff 58%,#d56bff);
  box-shadow: 0 4px 10px rgba(0, 122, 255, .22);
}

.ai-heading {
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.ai-title {
  font-size: var(--text-headline, 17px);
  font-weight: 600;
  line-height: 1.2;
  color: var(--label, #000);
}

.ai-subtitle {
  margin-top: 2px;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
  font-size: 11px;
  line-height: 1.2;
  color: var(--label-3, rgba(60, 60, 67, .38));
}

.ai-close {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border: none;
  border-radius: 50%;
  font-size: 13px;
  color: var(--label-2, rgba(60, 60, 67, .6));
  background: var(--fill-quaternary, rgba(116, 116, 128, .08));
  cursor: pointer;
  transition: background .15s ease, transform .15s ease;
}

.ai-close:hover {
  background: var(--fill-tertiary);
  transform: scale(1.04);
}

.ai-body {
  flex: 1;
  overflow-y: auto;
  padding: 16px 14px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.ai-card {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  padding: 12px;
  border: 0.5px solid var(--separator);
  border-radius: 18px;
  background: color-mix(in srgb, var(--bg-secondary, #fff) 86%, transparent);
  box-shadow: 0 2px 10px rgba(0, 0, 0, .03);
}

.ai-action,
.ai-fill {
  min-height: 44px;
  padding: 0 var(--space-4, 16px);
  border: none;
  border-radius: var(--radius-md, 8px);
  font-size: var(--text-subhead, 15px);
  color: var(--blue, #007aff);
  background: var(--fill-quaternary, rgba(116, 116, 128, .08));
  cursor: pointer;
}

.ai-action:hover,
.ai-fill:hover {
  background: var(--fill-quaternary, rgba(116, 116, 128, .16));
}

.ai-action:disabled,
.ai-fill:disabled {
  opacity: .5;
  cursor: default;
}

.ai-card-subject {
  width: 100%;
  font-size: var(--text-subhead, 15px);
  font-weight: 600;
  color: var(--label, #000);
}

.ai-card-text {
  width: 100%;
  max-height: 220px;
  margin: 0;
  overflow-y: auto;
  font-family: inherit;
  font-size: var(--text-subhead, 15px);
  line-height: 1.5;
  color: var(--label, #000);
  white-space: pre-wrap;
  word-break: break-word;
}

.ai-messages {
  display: flex;
  flex-direction: column;
  gap: var(--space-2, 8px);
}

.ai-msg {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.ai-msg.user {
  align-items: flex-end;
}

.ai-bubble {
  max-width: 88%;
  padding: 10px 14px;
  border: 0.5px solid var(--separator);
  border-radius: 18px 18px 18px 6px;
  font-size: var(--text-subhead, 15px);
  line-height: 1.5;
  color: var(--label, #000);
  background: var(--bg-secondary, #fff);
  box-shadow: 0 1px 4px rgba(0, 0, 0, .035);
  white-space: pre-wrap;
  word-break: break-word;
}

.ai-msg.user .ai-bubble {
  border-color: transparent;
  border-radius: 18px 18px 6px 18px;
  color: #fff;
  background: linear-gradient(145deg, #0a84ff, #0066d6);
  box-shadow: 0 4px 12px rgba(0, 122, 255, .18);
}

.ai-bubble--muted {
  color: var(--label-3, rgba(60, 60, 67, .38));
}

.ai-actions {
  width: 100%;
  margin: 0;
  padding: 4px 10px;
  list-style: none;
  border-radius: 12px;
  background: var(--fill-quaternary);
  font-size: var(--text-footnote, 13px);
}

.ai-actions li {
  display: flex;
  align-items: center;
  gap: 4px;
  min-height: 30px;
  color: var(--label-2, rgba(60, 60, 67, .6));
}

.ai-actions li + li {
  border-top: 0.5px solid var(--separator, rgba(60, 60, 67, .29));
}

.ai-actions li.ok {
  color: #34c759;
}

.ai-actions li.fail {
  color: #ff3b30;
}

.ai-footer {
  display: flex;
  align-items: flex-end;
  gap: 8px;
  padding: 10px 12px 12px;
  border-top: 0.5px solid var(--separator, rgba(60, 60, 67, .29));
  background: color-mix(in srgb, var(--bg-secondary, #fff) 78%, transparent);
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
}

.ai-input {
  flex: 1;
  min-height: 44px;
  max-height: 120px;
  padding: 11px 14px;
  border: 0.5px solid var(--separator, rgba(60, 60, 67, .29));
  border-radius: 18px;
  font-family: inherit;
  font-size: var(--text-subhead, 15px);
  line-height: 1.4;
  color: var(--label, #000);
  background: var(--fill-quaternary, rgba(118, 118, 128, .08));
  outline: none;
  resize: none;
  transition: border-color .16s ease, background .16s ease;
}

.ai-input:focus {
  border-color: color-mix(in srgb, var(--blue, #007aff) 70%, transparent);
  background: var(--bg-secondary, #fff);
}

.ai-send {
  width: 44px;
  height: 44px;
  flex: 0 0 auto;
  padding: 0;
  border: none;
  border-radius: 50%;
  font-size: 0;
  color: #fff;
  background: var(--blue, #007aff);
  cursor: pointer;
  box-shadow: 0 4px 10px rgba(0, 122, 255, .22);
  transition: transform .16s ease, opacity .16s ease;
}

.ai-send::after {
  content: '↑';
  font-size: 18px;
  font-weight: 600;
}

.ai-send:hover:not(:disabled) {
  transform: scale(1.04);
}

.ai-send:disabled {
  opacity: .45;
  cursor: default;
}

@media (max-width: 600px) {
  .ai-panel {
    top: 8px;
    right: 8px;
    bottom: 8px;
    width: calc(100vw - 16px);
    border-radius: 22px;
  }

  .ai-fab {
    right: 16px;
    bottom: 16px;
  }
}

.ai-context { display:flex; align-items:center; gap:6px; margin:10px 14px 0; padding:7px 10px; border-radius:8px; background:color-mix(in srgb, var(--primary) 7%, transparent); color:var(--text-secondary); font-size:12px; }
.ai-context strong { color:var(--text-primary); font-weight:600; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }


/* centered floating chat */
.ai-panel {
  top: 0;
  right: 0;
  bottom: 0;
  left: 0;
  margin: auto;
  width: min(560px, calc(100vw - 32px));
  height: min(680px, calc(100vh - 48px));
  max-height: calc(100vh - 48px);
  transform-origin: center center;
  border-radius: 26px;
  box-shadow: 0 32px 80px rgba(0,0,0,.32), 0 2px 8px rgba(0,0,0,.08);
}
.ai-chat-backdrop {
  pointer-events: auto;
  background: transparent !important;
  backdrop-filter: none !important;
  -webkit-backdrop-filter: none !important;
}
.ai-header-actions { display:flex; align-items:center; gap:4px; }
.ai-min {
  width:30px; height:30px; border:0; border-radius:50%; cursor:pointer;
  color:var(--label-2, rgba(60,60,67,.6)); background:var(--fill-quaternary, rgba(116,116,128,.08));
  font-size:18px; line-height:1; display:grid; place-items:center;
}
.ai-min:hover { background:var(--fill-tertiary); }
.ai-mini-bubble {
  position: fixed; right: 20px; bottom: 20px; z-index: 4000;
  width: 52px; height: 52px; border-radius: 50%; border: 0; cursor: pointer;
  display: grid; place-items: center; color: #fff;
  background: linear-gradient(135deg,#55d6ff,#7c7bff 58%,#d56bff);
  box-shadow: 0 12px 30px rgba(124,123,255,.42);
}
.ai-mini-bubble:hover { transform: translateY(-2px) scale(1.04); }
.ai-mini-bubble:active { transform: scale(.94); }
@media (max-width: 600px) {
  .ai-panel { top:0; right:0; bottom:0; left:0; width:calc(100vw - 12px); height:calc(100vh - 24px); max-height:calc(100vh - 24px); border-radius:20px; }
}
</style>
