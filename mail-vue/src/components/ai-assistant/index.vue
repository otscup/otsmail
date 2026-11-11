<template>
  <div class="ai-assistant" :class="{ 'is-inline': inline }">
    <button class="ai-fab" type="button" :aria-label="t('aiMenuTitle')" :title="t('aiMenuTitle')"
            :aria-expanded="menuOpen" @click="toggleFeatureMenu($event)">
      <CreamBun :size="inline ? 26 : 44" />
    </button>
    <Teleport to="body">
      <!-- 常驻奶团子：默认、缩小、关闭三种状态都在，可拖动，位置本地记忆。
           详情页的 reader 实例只负责工具栏按钮，由全局头部实例提供这一颗，避免重复渲染。 -->
      <div
          v-if="!reader"
          ref="bunRef"
          class="ai-mini-draggable-bun"
          :class="{ 'is-dragging': bunDragging }"
          :style="{ left: bunPos.x + 'px', top: bunPos.y + 'px' }"
          role="button"
          tabindex="0"
          :aria-label="t('aiAssistant')"
          :title="t('aiAssistant')"
          @pointerdown="onBunPointerDown"
          @pointermove="onBunPointerMove"
          @pointerup="onBunPointerUp"
          @pointercancel="onBunPointerUp"
          @keydown.enter.prevent="togglePanel"
          @keydown.space.prevent="togglePanel"
      >
        <CreamBun :size="56" :motion="idleMotion"/>
        <Transition name="ai-bun-bubble">
          <div
              v-if="bubbleVisible"
              class="ai-bun-bubble"
              :class="{ 'is-below': bubbleBelow, 'is-left': bubbleAlignLeft }"
              role="status"
              @pointerdown.stop
              @pointerup.stop
              @pointercancel.stop
              @pointermove.stop
              @click.stop="dismissBubble"
          >
            <span class="ai-bun-bubble-text">{{ bubbleText }}</span>
            <button class="ai-bun-bubble-close" type="button" :aria-label="t('aiBubbleClose')"
                    @click.stop="dismissBubble">×</button>
          </div>
        </Transition>
      </div>
    </Teleport>

    <Teleport to="body">
      <Transition name="ai-menu">
        <div v-if="menuOpen" class="ai-feature-menu is-floating" role="menu" :aria-label="t('aiMenuTitle')"
             :style="menuStyle" @pointerdown.stop>
          <div class="ai-feature-menu-title">{{ t('aiMenuTitle') }}</div>
          <button v-for="item in menuItems" :key="item.key" class="ai-feature-item" type="button"
                  role="menuitem" :disabled="item.disabled"
                  :title="item.disabled ? t(item.reason) : t(item.label)"
                  @click="runMenuItem(item)">
            <Icon :icon="item.icon" width="16" height="16"/>
            <span class="ai-feature-label">{{ t(item.label) }}</span>
            <span v-if="item.disabled" class="ai-feature-hint">{{ t(item.reason) }}</span>
          </button>
        </div>
      </Transition>
    </Teleport>

    <Teleport to="body">
      <!-- 不再有全屏遮罩：点页面其它地方不关闭面板，面板靠 z-index 浮在最上层 -->
      <Transition :css="false" @enter="enterPanel" @leave="leavePanel">
        <section v-if="open" ref="panelRef" class="ai-panel"
                 :class="{ 'is-dragging': panelDragging, 'is-compose-docked': composeDocked }" role="dialog"
                 :aria-label="t('aiAssistant')" :style="panelStyle">
          <header class="ai-header"
                  @pointerdown="onHeaderPointerDown"
                  @pointermove="onHeaderPointerMove"
                  @pointerup="onHeaderPointerUp"
                  @pointercancel="onHeaderPointerUp">
            <div class="ai-brand">
              <button class="ai-bun-btn" type="button" :aria-label="t('aiMenuTitle')" :title="t('aiMenuTitle')"
                      :aria-expanded="menuOpen" @click.stop="toggleFeatureMenu($event)">
                <CreamBun :size="40" class="ai-header-bun"/>
              </button>
              <div class="ai-heading">
                <span class="ai-title">{{ t('aiAssistant') }}</span>
                <span class="ai-subtitle">{{ t('aiSubtitle') }}</span>
              </div>
            </div>
            <div class="ai-header-actions">
              <button class="ai-min" type="button"
                      :aria-label="bubbleOn ? t('aiBubbleOff') : t('aiBubbleOn')"
                      :title="bubbleOn ? t('aiBubbleOff') : t('aiBubbleOn')"
                      @click="toggleBubbleTips">
                <Icon :icon="bubbleOn ? 'ph:bell-simple' : 'ph:bell-slash'" width="16" height="16"/>
              </button>
              <button class="ai-min" type="button" :aria-label="t('aiMinimize')" @click="minimizePanel">–</button>
            </div>

          </header>

      <div class="ai-body" ref="bodyRef">
        <div class="ai-context" v-if="activeEmailId">
          <div class="ai-context-title">
            <span>{{ t('aiWorkingOn') }}</span>
            <strong>{{ activeEmailSubject || ('#' + activeEmailId) }}</strong>
          </div>
          <div class="ai-context-meta" v-if="emailContext.emailId === activeEmailId && (emailContext.from || emailContext.time)">
            <span class="ai-context-from" v-if="emailContext.from">{{ emailContext.from }}</span>
            <span v-if="emailContext.time">· {{ emailContext.time }}</span>
          </div>
          <p class="ai-context-excerpt" v-if="emailContext.emailId === activeEmailId && emailContext.excerpt">
            {{ emailContext.excerpt }}
          </p>
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
import CreamBun from './cream-bun.vue'
import {useIdleMotion} from './use-idle-motion.js'
import {aiCommand, aiPolish, aiReply, aiSummary} from '@/request/ai.js'
import {useEmailStore} from '@/store/email.js'
import {useAccountStore} from '@/store/account.js'
import {useSettingStore} from '@/store/setting.js'
import {cvtR2Url} from '@/utils/convert.js'
import {formatDetailDate} from '@/utils/day.js'

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
const emailStore = useEmailStore()
const activeEmailId = ref(props.emailId)
const activeEmailSubject = ref(props.emailSubject)
const composeMode = ref(false)
const panelText = ref(props.text)
// 当前邮件上下文：详情页由 emailStore.contentData.email 提供，供上下文条展示
const emailContext = ref({emailId: 0, subject: '', from: '', time: '', excerpt: ''})

function emailPlainText(record) {
  const source = String(record?.text || record?.html || '')
  return source
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function refreshEmailContext() {
  const current = emailStore.contentData?.email
  // 详情页传了 emailId 时只认同一封，避免列表里点到别的邮件时串上下文
  const match = current && (!props.emailId || Number(current.emailId) === Number(props.emailId))
  if (!match) {
    emailContext.value = {emailId: 0, subject: '', from: '', time: '', excerpt: ''}
    return
  }
  const name = String(current.name || '').trim()
  const address = String(current.sendEmail || '').trim()
  const plain = emailPlainText(current)
  emailContext.value = {
    emailId: Number(current.emailId) || 0,
    subject: String(current.subject || ''),
    from: name && address ? `${name} <${address}>` : (address || name),
    time: current.createTime ? formatDetailDate(current.createTime) : '',
    excerpt: plain.length > 240 ? `${plain.slice(0, 240)}…` : plain
  }
}

function openPanel(emailId = 0, subject = '', draftText = '') {
  composeMode.value = false
  syncActiveContext()
  if (emailId) {
    activeEmailId.value = Number(emailId) || 0
    activeEmailSubject.value = subject || activeEmailSubject.value
  }
  panelText.value = draftText || props.text
  open.value = true
}
// 只有「缩小」一个收起入口：面板收起后奶团子仍常驻，不再有独立的关闭按钮
function minimizePanel() {
  open.value = false
  document.body.classList.remove('compose-ai-open')
}
function togglePanel() {
  if (!open.value) syncActiveContext()
  open.value = !open.value
}

// ---- 常驻奶团子：可拖动，位置存本地 ----
const BUN_KEY = 'otsmail.ai.bunPos'
const BUN_SIZE = 64
const BUN_MARGIN = 20
// 位移小于该阈值仍按「点击打开」处理，避免手指抖动把打开动作吃掉
const DRAG_THRESHOLD = 4

function clampBun(pos) {
  const maxX = Math.max(0, window.innerWidth - BUN_SIZE - BUN_MARGIN)
  const maxY = Math.max(0, window.innerHeight - BUN_SIZE - BUN_MARGIN)
  return {
    x: Math.min(Math.max(pos.x, BUN_MARGIN), maxX),
    y: Math.min(Math.max(pos.y, BUN_MARGIN), maxY)
  }
}

// 默认不贴角：离右下角各留一截，明显但仍在右下象限；小屏会被 clampBun 夹回可视区
const BUN_DEFAULT_RIGHT = 64
const BUN_DEFAULT_BOTTOM = 88

function defaultBunPos() {
  return clampBun({
    x: window.innerWidth - BUN_SIZE - BUN_DEFAULT_RIGHT,
    y: window.innerHeight - BUN_SIZE - BUN_DEFAULT_BOTTOM
  })
}

function loadBunPos() {
  try {
    const saved = JSON.parse(localStorage.getItem(BUN_KEY) || 'null')
    if (saved && Number.isFinite(saved.x) && Number.isFinite(saved.y)) {
      return clampBun(saved)
    }
  } catch (e) {
    // 隐私模式或脏数据：回到默认角落
  }
  return defaultBunPos()
}

const bunRef = ref(null)
const bunPos = ref(loadBunPos())
const bunDragging = ref(false)
let bunDrag = null

function onBunPointerDown(event) {
  if (event.pointerType === 'mouse' && event.button !== 0) return
  // 用户开始拖/点奶团子时，提示气泡立即收掉，避免挡手
  stopBubbles()
  // 空闲动作立刻中止，并把下一次动作的计时重新拨到 6～12 分钟后
  stopIdleMotion()
  scheduleIdleMotion()
  bunDrag = {
    id: event.pointerId,
    startX: event.clientX,
    startY: event.clientY,
    originX: bunPos.value.x,
    originY: bunPos.value.y,
    moved: false
  }
  event.currentTarget.setPointerCapture?.(event.pointerId)
}

function onBunPointerMove(event) {
  if (!bunDrag || bunDrag.id !== event.pointerId) return
  const dx = event.clientX - bunDrag.startX
  const dy = event.clientY - bunDrag.startY
  if (!bunDrag.moved && Math.hypot(dx, dy) < DRAG_THRESHOLD) return
  bunDrag.moved = true
  bunDragging.value = true
  bunPos.value = clampBun({x: bunDrag.originX + dx, y: bunDrag.originY + dy})
}

// 松手时靠近哪条边就贴到该边的安全边距上，不靠边则停在原地
function snapBunPos(pos) {
  const next = clampBun(pos)
  const maxX = Math.max(0, window.innerWidth - BUN_SIZE - BUN_MARGIN)
  const maxY = Math.max(0, window.innerHeight - BUN_SIZE - BUN_MARGIN)
  if (next.x - BUN_MARGIN <= SNAP_THRESHOLD) next.x = BUN_MARGIN
  else if (maxX - next.x <= SNAP_THRESHOLD) next.x = maxX
  if (next.y - BUN_MARGIN <= SNAP_THRESHOLD) next.y = BUN_MARGIN
  else if (maxY - next.y <= SNAP_THRESHOLD) next.y = maxY
  return next
}

function onBunPointerUp(event) {
  if (!bunDrag || bunDrag.id !== event.pointerId) return
  const moved = bunDrag.moved
  bunDrag = null
  bunDragging.value = false
  if (event.currentTarget.hasPointerCapture?.(event.pointerId)) {
    event.currentTarget.releasePointerCapture(event.pointerId)
  }
  if (moved) {
    bunPos.value = snapBunPos(bunPos.value)
    try {
      localStorage.setItem(BUN_KEY, JSON.stringify(bunPos.value))
    } catch (e) {
      // 存不下只影响下次打开的位置，不影响本次交互
    }
    return
  }
  togglePanel()
}

// ---- 面板拖动：只以顶栏为把手，不抢正文滚动与输入框事件 ----
const panelRef = ref(null)
const panelDragging = ref(false)
const panelOffset = ref({x: 0, y: 0})
let panelDrag = null

// 松手时距视口边缘 28px 内就吸附贴边，留 12px 安全边距
const SNAP_THRESHOLD = 28
const PANEL_SNAP_MARGIN = 12

function snapPanelToEdge() {
  const el = panelRef.value
  if (!el) return
  const rect = el.getBoundingClientRect()
  const maxGapX = window.innerWidth - rect.right
  const maxGapY = window.innerHeight - rect.bottom
  let dx = 0
  let dy = 0
  if (rect.left <= SNAP_THRESHOLD) dx = PANEL_SNAP_MARGIN - rect.left
  else if (maxGapX <= SNAP_THRESHOLD) dx = window.innerWidth - PANEL_SNAP_MARGIN - rect.right
  if (rect.top <= SNAP_THRESHOLD) dy = PANEL_SNAP_MARGIN - rect.top
  else if (maxGapY <= SNAP_THRESHOLD) dy = window.innerHeight - PANEL_SNAP_MARGIN - rect.bottom
  if (dx || dy) {
    panelOffset.value = {x: panelOffset.value.x + dx, y: panelOffset.value.y + dy}
  }
}

// ---- 写信避让：写信框不能动，只能面板让 ----
const COMPOSE_GAP = 16
const PANEL_MIN_WIDTH = 300
// 面板宽度可临时收窄（只在写信避让时用），关掉写信/面板后恢复默认
const composeDocked = ref(false)
// 避让前的默认宽度：收窄后不能拿收窄值当基准，否则窗口变宽也不会长回去
const defaultPanelWidth = ref(0)

function composeBoxEl() {
  const send = document.querySelector('.send')
  // .send 用 v-show 控制显隐，隐藏时矩形为 0，直接当作没有写信框
  if (!send || getComputedStyle(send).display === 'none') return null
  const box = send.querySelector('.write-box')
  if (!box) return null
  return box.getBoundingClientRect().width ? box : null
}

// 规则：右侧优先 → 左侧 → 两侧都不够时收窄贴边。任何分支都保证面板与写信框不相交。
function dockPanelBesideCompose() {
  const panel = panelRef.value
  const box = composeBoxEl()
  // 窄屏仍是整屏面板，不参与桌面避让
  if (!panel || !box || window.innerWidth < 1025) return
  const boxRect = box.getBoundingClientRect()
  const vw = window.innerWidth
  const vh = window.innerHeight
  const m = PANEL_SNAP_MARGIN
  const rightGap = vw - m - COMPOSE_GAP - boxRect.right
  const leftGap = boxRect.left - COMPOSE_GAP - m
  // 面板默认宽度由主题 CSS 决定（桌面 380 / 写信态 340）。只在尚未收窄时量一次，
  // 且用 offsetWidth（不受进场动画 scale 影响）；收窄后不能拿当前宽度当基准。
  if (!composeDocked.value) defaultPanelWidth.value = panel.offsetWidth || 380
  const baseWidth = defaultPanelWidth.value || 380
  let width = baseWidth
  let left
  if (rightGap >= PANEL_MIN_WIDTH) {
    width = Math.min(baseWidth, rightGap)
    left = boxRect.right + COMPOSE_GAP
  } else if (leftGap >= PANEL_MIN_WIDTH) {
    width = Math.min(baseWidth, leftGap)
    left = boxRect.left - COMPOSE_GAP - width
  } else if (rightGap >= leftGap) {
    width = rightGap
    left = vw - m - width
  } else {
    width = leftGap
    left = m
  }
  // 剩余空间实在没有可用宽度时宁可不显示，也不压住写信框
  if (width < 120) return
  const height = panel.offsetHeight || Math.min(680, vh - 48)
  const top = Math.min(Math.max(boxRect.top, m), Math.max(m, vh - m - height))
  panel.style.setProperty('--ai-panel-w', `${Math.round(width)}px`)
  composeDocked.value = true
  // 宽度变化会让居中定位重新计算，改完宽度后再量一次矩形
  const rect = panel.getBoundingClientRect()
  panelOffset.value = {
    x: panelOffset.value.x + left - rect.left,
    y: panelOffset.value.y + top - rect.top
  }
}

function undockPanel() {
  const panel = panelRef.value
  composeDocked.value = false
  // 下次避让重新量默认宽度（写信态 / 普通态的默认宽度不同）
  defaultPanelWidth.value = 0
  if (!panel) return
  panel.style.removeProperty('--ai-panel-w')
  // 恢复默认宽度后可能顶出视口，重新夹一次
  const rect = panel.getBoundingClientRect()
  let dx = 0
  let dy = 0
  if (rect.left < PANEL_SNAP_MARGIN) dx = PANEL_SNAP_MARGIN - rect.left
  else if (rect.right > window.innerWidth - PANEL_SNAP_MARGIN) dx = window.innerWidth - PANEL_SNAP_MARGIN - rect.right
  if (rect.top < PANEL_SNAP_MARGIN) dy = PANEL_SNAP_MARGIN - rect.top
  else if (rect.bottom > window.innerHeight - PANEL_SNAP_MARGIN) dy = window.innerHeight - PANEL_SNAP_MARGIN - rect.bottom
  if (dx || dy) panelOffset.value = {x: panelOffset.value.x + dx, y: panelOffset.value.y + dy}
}

let dockRaf = 0
function scheduleComposeDock() {
  if (dockRaf) return
  dockRaf = requestAnimationFrame(() => {
    dockRaf = 0
    if (!open.value || !props.inline || props.reader) return
    if (window.innerWidth < 1025) {
      undockPanel()
      return
    }
    if (composeBoxEl()) dockPanelBesideCompose()
    else undockPanel()
  })
}

let composeResizeObserver = null
let composeStyleObserver = null

function watchComposeBox() {
  // 只有顶栏这颗全局实例负责面板避让
  if (!props.inline || props.reader) return
  const send = document.querySelector('.send')
  if (!send || typeof ResizeObserver === 'undefined') return
  composeResizeObserver = new ResizeObserver(scheduleComposeDock)
  const box = send.querySelector('.write-box')
  if (box) composeResizeObserver.observe(box)
  // v-show 切换的是 .send 的 display，ResizeObserver 在隐藏/显示时不一定回调，补一层属性监听
  composeStyleObserver = new MutationObserver(scheduleComposeDock)
  composeStyleObserver.observe(send, {attributes: true, attributeFilter: ['style', 'class']})
}
const panelStyle = computed(() => ({
  '--ai-drag-x': `${panelOffset.value.x}px`,
  '--ai-drag-y': `${panelOffset.value.y}px`
}))

function onHeaderPointerDown(event) {
  if (event.pointerType === 'mouse' && event.button !== 0) return
  if (event.target.closest('button')) return
  const panel = event.currentTarget.closest('.ai-panel')
  if (!panel) return
  const rect = panel.getBoundingClientRect()
  panelDrag = {
    id: event.pointerId,
    startX: event.clientX,
    startY: event.clientY,
    originX: panelOffset.value.x,
    originY: panelOffset.value.y,
    // 面板到视口四边的余量，直接换算成偏移量允许的上下界
    minX: panelOffset.value.x - rect.left,
    maxX: panelOffset.value.x + (window.innerWidth - rect.right),
    minY: panelOffset.value.y - rect.top,
    maxY: panelOffset.value.y + (window.innerHeight - rect.bottom),
    moved: false
  }
  panelDragging.value = true
  event.currentTarget.setPointerCapture?.(event.pointerId)
}

function onHeaderPointerMove(event) {
  if (!panelDrag || panelDrag.id !== event.pointerId) return
  const dx = event.clientX - panelDrag.startX
  const dy = event.clientY - panelDrag.startY
  if (Math.hypot(dx, dy) >= DRAG_THRESHOLD) panelDrag.moved = true
  panelOffset.value = {
    x: Math.min(Math.max(panelDrag.originX + dx, panelDrag.minX), panelDrag.maxX),
    y: Math.min(Math.max(panelDrag.originY + dy, panelDrag.minY), panelDrag.maxY)
  }
}

function onHeaderPointerUp(event) {
  if (!panelDrag || panelDrag.id !== event.pointerId) return
  const moved = panelDrag.moved
  panelDrag = null
  panelDragging.value = false
  if (event.currentTarget.hasPointerCapture?.(event.pointerId)) {
    event.currentTarget.releasePointerCapture(event.pointerId)
  }
  if (moved) snapPanelToEdge()
}

// 窗口尺寸变化（含手机横竖屏）后把奶团子夹回可视区
function onWindowResize() {
  bunPos.value = clampBun(bunPos.value)
  // 写信框尺寸跟着视口变，避让要重算
  if (open.value && props.inline && !props.reader) {
    // 缩到窄屏后回到整屏样式，撤销收窄
    if (window.innerWidth < 1025) {
      if (composeDocked.value) undockPanel()
    } else if (composeBoxEl()) dockPanelBesideCompose()
    else if (composeDocked.value) undockPanel()
  }
  // 面板已拖到边缘时，窗口变化后仍保持在可视区内
  if (open.value && !panelDragging.value && panelRef.value) {
    const rect = panelRef.value.getBoundingClientRect()
    let dx = 0
    let dy = 0
    if (rect.left < PANEL_SNAP_MARGIN) dx = PANEL_SNAP_MARGIN - rect.left
    else if (rect.right > window.innerWidth - PANEL_SNAP_MARGIN) dx = window.innerWidth - PANEL_SNAP_MARGIN - rect.right
    if (rect.top < PANEL_SNAP_MARGIN) dy = PANEL_SNAP_MARGIN - rect.top
    else if (rect.bottom > window.innerHeight - PANEL_SNAP_MARGIN) dy = window.innerHeight - PANEL_SNAP_MARGIN - rect.bottom
    if (dx || dy) panelOffset.value = {x: panelOffset.value.x + dx, y: panelOffset.value.y + dy}
  }
}
watch(() => props.emailId, value => {
  if (!value) return
  activeEmailId.value = Number(value) || 0
  refreshEmailContext()
  activeEmailSubject.value = props.emailSubject || emailContext.value.subject || activeEmailSubject.value
})
// 当前邮件由 emailStore 的详情数据驱动：详情页加载/切换邮件时实时更新上下文。
// 切换邮件不重置对话历史，只清掉上一封生成的草稿卡片，避免「填入」落到错信上。
watch(() => emailStore.contentData?.email?.emailId, () => {
  const previousId = activeEmailId.value
  if (!composeMode.value) syncActiveContext()
  if (open.value && activeEmailId.value !== previousId) {
    draft.value = null
    nextTick(() => scrollToBottom())
  }
})
function onComposeAi(event) {
  if (!props.inline || props.reader) return
  const detail = event.detail || {}
  const current = emailStore.contentData?.email
  activeEmailId.value = Number(detail.emailId) || current?.emailId || 0
  activeEmailSubject.value = detail.subject || current?.subject || ''
  panelText.value = detail.text || ''
  composeMode.value = true
  open.value = true
  document.body.classList.add('compose-ai-open')
  // 等面板真正挂载、写信框完成布局后再避让
  nextTick(() => scheduleComposeDock())
}
watch(() => props.emailSubject, value => { activeEmailSubject.value = value })

// ---- 奶团子提示气泡：首次冒一次，之后每小时最多一次；开面板或拖动即停止 ----
const BUBBLE_ON_KEY = 'otsmail.ai.bubbleOn'
const BUBBLE_AT_KEY = 'otsmail.ai.bubbleAt'
const BUBBLE_LAST_KEY = 'otsmail.ai.bubbleLast'
const BUBBLE_INTERVAL = 60 * 60 * 1000
const BUBBLE_DURATION = 6000
const BUBBLE_TEXTS = ['aiBubble1', 'aiBubble2', 'aiBubble3', 'aiBubble4', 'aiBubble5']
const bubbleOn = ref(localStorage.getItem(BUBBLE_ON_KEY) !== '0')
const bubbleText = ref('')
const bubbleVisible = ref(false)
const bubbleBelow = computed(() => bunPos.value.y < 120)
// 奶团子被拖到左半屏时气泡改为左对齐，避免超出屏幕
const bubbleAlignLeft = computed(() => bunPos.value.x < window.innerWidth / 2)
let bubbleTimer = null
let bubbleHideTimer = null

function dismissBubble() {
  bubbleVisible.value = false
  if (bubbleHideTimer) {
    clearTimeout(bubbleHideTimer)
    bubbleHideTimer = null
  }
}

function pickBubbleText() {
  const last = Number(localStorage.getItem(BUBBLE_LAST_KEY) ?? -1)
  let index = Math.floor(Math.random() * BUBBLE_TEXTS.length)
  // 随机但不连着重复同一句
  if (BUBBLE_TEXTS.length > 1 && index === last) index = (index + 1) % BUBBLE_TEXTS.length
  try {
    localStorage.setItem(BUBBLE_LAST_KEY, String(index))
  } catch (e) {
    // 存不下只影响去重
  }
  return t(BUBBLE_TEXTS[index])
}

function showBubble() {
  if (!bubbleOn.value || open.value || bunDragging.value) return
  // 动作播放期间不出气泡，等动作播完再找机会
  if (idleMotion.value) {
    bubbleTimer = setTimeout(showBubble, 30000)
    return
  }
  bubbleText.value = pickBubbleText()
  bubbleVisible.value = true
  try {
    localStorage.setItem(BUBBLE_AT_KEY, String(Date.now()))
  } catch (e) {
    // 忽略存储失败
  }
  if (bubbleHideTimer) clearTimeout(bubbleHideTimer)
  bubbleHideTimer = setTimeout(dismissBubble, BUBBLE_DURATION)
}

function scheduleBubble() {
  if (!bubbleOn.value) return
  const last = Number(localStorage.getItem(BUBBLE_AT_KEY) || 0)
  const first = !last
  if (!first && Date.now() - last < BUBBLE_INTERVAL) return
  bubbleTimer = setTimeout(showBubble, first ? 1800 : 4000)
}

function stopBubbles() {
  if (bubbleTimer) {
    clearTimeout(bubbleTimer)
    bubbleTimer = null
  }
  dismissBubble()
}

// ---- 奶团子空闲小动作：6～12 分钟随机触发一次，与气泡互斥 ----
const {
  motion: idleMotion,
  schedule: scheduleIdleMotion,
  stop: stopIdleMotion,
  bind: bindIdleMotion,
  unbind: unbindIdleMotion
} = useIdleMotion({
  // 气泡可见或正在拖动时不允许开始动作
  canPlay: () => !bubbleVisible.value && !bunDragging.value
})

function toggleBubbleTips() {
  bubbleOn.value = !bubbleOn.value
  try {
    localStorage.setItem(BUBBLE_ON_KEY, bubbleOn.value ? '1' : '0')
  } catch (e) {
    // 忽略存储失败
  }
  if (!bubbleOn.value) stopBubbles()
}

// ---- 顶栏奶团子：AI 功能菜单（只列真实可用的能力） ----
const menuOpen = ref(false)
// 菜单挂在 body 上（面板关闭时也要能显示），用锚点按钮的 rect 换算固定定位
const menuAnchor = ref({ left: 8, top: 8 })
const MENU_WIDTH = 250
const MENU_EST_HEIGHT = 210
const menuStyle = computed(() => ({ left: `${menuAnchor.value.left}px`, top: `${menuAnchor.value.top}px` }))
const menuItems = computed(() => [
  {
    key: 'summary',
    label: 'aiMenuSummary',
    icon: 'ph:article-medium',
    disabled: !activeEmailId.value,
    reason: 'aiMenuNeedEmail'
  },
  {
    key: 'reply',
    label: 'aiMenuReply',
    icon: 'ph:arrow-bend-up-left',
    disabled: !activeEmailId.value,
    reason: 'aiMenuNeedEmail'
  },
  {
    key: 'polish',
    label: 'aiMenuPolish',
    icon: 'ph:sparkle',
    disabled: !panelText.value,
    reason: 'aiMenuNeedText'
  },
  {
    key: 'unread',
    label: 'aiMenuUnread',
    icon: 'ph:envelope-simple',
    disabled: false
  }
])

// 面板没开时也同步当前上下文，避免菜单项误判「没有邮件/没有正文」
function syncActiveContext() {
  refreshEmailContext()
  const ctx = emailContext.value
  if (ctx.emailId) {
    activeEmailId.value = ctx.emailId
    activeEmailSubject.value = ctx.subject
  } else if (props.emailId) {
    activeEmailId.value = Number(props.emailId) || 0
    activeEmailSubject.value = props.emailSubject || ''
  } else {
    activeEmailId.value = 0
    activeEmailSubject.value = ''
  }
  // 写信页正文优先，别被空 props 覆盖
  if (!composeMode.value) panelText.value = props.text
}

function toggleFeatureMenu(event) {
  if (menuOpen.value) {
    menuOpen.value = false
    return
  }
  positionMenu(event)
  menuOpen.value = true
  if (menuOpen.value) stopBubbles()
}

// 菜单定位：贴按钮下方，左右与上下都夹进视口；放不下就翻到按钮上方
function positionMenu(event) {
  const anchor = event?.currentTarget
  if (!anchor?.getBoundingClientRect) return
  const rect = anchor.getBoundingClientRect()
  const vw = window.innerWidth
  const vh = window.innerHeight
  const width = Math.min(MENU_WIDTH, vw - 16)
  const left = Math.min(Math.max(8, rect.left), Math.max(8, vw - width - 8))
  let top = rect.bottom + 8
  if (top + MENU_EST_HEIGHT > vh - 8) top = Math.max(8, rect.top - MENU_EST_HEIGHT - 8)
  menuAnchor.value = { left: Math.round(left), top: Math.round(top) }
}

async function runMenuItem(item) {
  if (item.disabled) return
  menuOpen.value = false
  if (!open.value && !composeMode.value) syncActiveContext()
  open.value = true
  await nextTick()
  if (item.key === 'summary') await summarizeActive()
  else if (item.key === 'reply') await doReply()
  else if (item.key === 'polish') await doPolish()
  else if (item.key === 'unread') sendMessage(t('aiPresetUnread'))
}

function onDocumentPointerDown(event) {
  if (menuOpen.value && !event.target.closest?.('.ai-feature-menu, .ai-bun-btn, .ai-fab')) {
    menuOpen.value = false
  }
}

let panelAnim = null
const panelReduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)')

// 注意：进出场动画只动 opacity / translate / scale（独立变换属性），绝不写 transform。
// 面板的拖动位移是 transform: translate3d(var(--ai-drag-x/y))，一旦动画写了 transform
// 并带 fill，就会长期覆盖拖动位移，表现为「拖不动」。
function enterPanel(el, done) {
  if (panelReduceMotion.matches || !el.animate) return done()
  if (panelAnim) panelAnim.cancel()
  el.style.opacity = '0'
  const anim = el.animate([
    {opacity: 0, translate: '0 18px', scale: '.965'},
    {opacity: 1, translate: '0 0', scale: '1'},
  ], {duration: 340, easing: 'cubic-bezier(.22,1.18,.36,1)', fill: 'both'})
  panelAnim = anim
  anim.onfinish = () => {
    // 及时撤销 fill，避免动画效果长期挤占合成层
    if (panelAnim === anim) {
      anim.cancel()
      panelAnim = null
    }
    el.style.opacity = ''
    done()
    // 进场动画期间 scale/translate 会污染 getBoundingClientRect，
    // 落位要在动画结束后再量一次，否则第一帧算出的偏移会有几像素误差
    scheduleComposeDock()
  }
}

function leavePanel(el, done) {
  if (panelReduceMotion.matches || !el.animate) return done()
  const current = getComputedStyle(el)
  if (panelAnim) panelAnim.cancel()
  const anim = el.animate([
    {opacity: current.opacity, translate: '0 0', scale: '1'},
    {opacity: 0, translate: '0 18px', scale: '.965'},
  ], {duration: 220, easing: 'cubic-bezier(.4,0,1,1)', fill: 'both'})
  panelAnim = anim
  anim.onfinish = () => {
    if (panelAnim === anim) {
      anim.cancel()
      panelAnim = null
    }
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
    if (composeMode.value) applyDraft(draft.value?.text, draft.value?.subject)
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

function send() {
  const text = input.value.trim()
  if (!text || busy.value) return
  input.value = ''
  sendMessage(text)
}

async function sendMessage(text) {
  if (!text || busy.value) return
  const history = messages.value.slice(-20).map(m => ({role: m.role === 'ai' ? 'assistant' : 'user', text: m.text}))
  messages.value.push({role: 'user', text})
  busy.value = true
  scrollToBottom()

  try {
    const res = await aiCommand(text, useAccountStore().currentAccountId, history, activeEmailId.value)
    messages.value.push({role: 'ai', text: res?.reply || '', actions: res?.actions || []})
    const draftAction = (res?.actions || []).find(action => action.ok && action.type === 'draft' && action.text)
    if (draftAction && composeMode.value) {
      applyDraft(draftAction.text, draftAction.subject)
    }
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

function applyDraft(text, subject = '') {
  const value = String(text || '').trim()
  if (!value) return false
  emit('fill', {subject, text: value})
  window.dispatchEvent(new CustomEvent('otsmail:ai-fill', {detail: {text: value, subject}}))
  ElMessage.success(t('aiFilled'))
  // Keep the panel open while composing; closing it resized the editor and made the window jump.
  if (!composeMode.value) open.value = false
  return true
}

function fillDraft() {
  applyDraft(draft.value?.text, draft.value?.subject)
}

async function scrollToBottom() {
  await nextTick()
  if (bodyRef.value) {
    bodyRef.value.scrollTop = bodyRef.value.scrollHeight
  }
}

function onKeydown(event) {
  if (event.key !== 'Escape') return
  if (menuOpen.value) {
    menuOpen.value = false
    return
  }
  if (open.value) open.value = false
}

watch(open, value => {
  if (value) {
    // 打开面板即停止冒泡，避免提示和对话抢注意力
    stopBubbles()
    menuOpen.value = false
    // 每次打开都回到默认居中位置，避免上次拖到边缘后这次找不到面板
    panelOffset.value = {x: 0, y: 0}
    scrollToBottom()
    // 写信框开着时，打开面板也要先让开
    nextTick(() => scheduleComposeDock())
  } else {
    document.body.classList.remove('compose-ai-open')
    undockPanel()
  }
})

onMounted(() => {
  window.addEventListener('keydown', onKeydown)
  window.addEventListener('otsmail:ai-compose', onComposeAi)
  window.addEventListener('resize', onWindowResize)
  document.addEventListener('pointerdown', onDocumentPointerDown)
  watchComposeBox()
  scheduleBubble()
  bindIdleMotion()
})
onUnmounted(() => {
  window.removeEventListener('keydown', onKeydown)
  window.removeEventListener('otsmail:ai-compose', onComposeAi)
  window.removeEventListener('resize', onWindowResize)
  document.removeEventListener('pointerdown', onDocumentPointerDown)
  unbindIdleMotion()
  composeResizeObserver?.disconnect()
  composeStyleObserver?.disconnect()
  if (dockRaf) cancelAnimationFrame(dockRaf)
  stopBubbles()
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
  padding: 0;
  border: none;
  border-radius: 50%;
  color: #fff;
  background: transparent;
  box-shadow: none;
  cursor: pointer;
  transition: transform .2s cubic-bezier(.2, .8, .2, 1);
}

.ai-fab:hover {
  transform: translateY(-1px) scale(1.04);
}

.ai-fab:active {
  transform: scale(.94);
}

.ai-panel {
  position: fixed;
  top: 12px;
  right: 12px;
  bottom: 12px;
  /* 无遮罩后面板必须真正浮在最上层：高于侧栏(101)、头部(40)与 Element 弹层(2000+) */
  z-index: 5000;
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
  position: relative;
  display: flex;
  align-items: center;
  justify-content: space-between;
  min-height: 64px;
  padding: 10px 14px 10px 16px;
  border-bottom: 0.5px solid var(--separator, rgba(60, 60, 67, .29));
  background: color-mix(in srgb, var(--bg-secondary, #fff) 80%, transparent);
  /* 顶栏是面板拖拽把手：禁掉触摸滚动与文字选择，否则移动端会变成滚页面 */
  cursor: grab;
  touch-action: none;
  user-select: none;
  -webkit-user-select: none;
}

.ai-panel.is-dragging .ai-header {
  cursor: grabbing;
}

.ai-brand {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
}

.ai-header-bun {
  flex: 0 0 auto;
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

.ai-context { display:flex; flex-direction:column; align-items:flex-start; gap:2px; margin:10px 14px 0; padding:7px 10px; border-radius:8px; background:color-mix(in srgb, var(--primary) 7%, transparent); color:var(--text-secondary); font-size:12px; }
.ai-context-title { display:flex; align-items:center; gap:6px; max-width:100%; }
.ai-context strong { color:var(--text-primary); font-weight:600; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.ai-context-meta { display:flex; align-items:center; gap:4px; max-width:100%; font-size:11px; }
.ai-context-from { overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.ai-context-excerpt { margin:2px 0 0; font-size:11px; line-height:1.45; display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; overflow:hidden; }


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
  /* 拖拽偏移走 CSS 变量：不覆盖进场/退场用 Web Animations 写入的 transform */
  transform: translate3d(var(--ai-drag-x, 0px), var(--ai-drag-y, 0px), 0);
  border-radius: 26px;
  box-shadow: 0 32px 80px rgba(0,0,0,.32), 0 2px 8px rgba(0,0,0,.08);
}
/* 写信避让时按可用空间收窄；全局 .ai-panel 的固定宽度是 !important，这里必须同样加 !important 才盖得住 */
.ai-panel.is-compose-docked { width: var(--ai-panel-w) !important; }
.ai-header-actions { display:flex; align-items:center; gap:4px; }
.ai-min {
  width:30px; height:30px; border:0; border-radius:50%; cursor:pointer;
  color:var(--label-2, rgba(60,60,67,.6)); background:var(--fill-quaternary, rgba(116,116,128,.08));
  font-size:18px; line-height:1; display:grid; place-items:center;
}
.ai-min:hover { background:var(--fill-tertiary); }
/* 顶栏奶团子：AI 功能菜单入口，不再是面板开关 */
.ai-bun-btn {
  display: inline-flex; padding: 0; border: 0; border-radius: 50%;
  background: transparent; cursor: pointer; flex: 0 0 auto;
}
.ai-bun-btn:hover { background: var(--fill-quaternary, rgba(116,116,128,.12)); }
.ai-bun-btn:focus-visible { outline: 2px solid var(--blue, #007aff); outline-offset: 2px; }
/* 菜单挂在 body 上：固定定位，层级高于面板(5000)，由 JS 用锚点按钮的 rect 写入 left/top */
.ai-feature-menu.is-floating {
  position: fixed;
  z-index: 5001;
  width: min(250px, calc(100vw - 16px));
}
.ai-feature-menu {
  position: absolute; left: 14px; top: calc(100% + 8px); z-index: 20;
  width: min(250px, calc(100% - 28px));
  padding: 6px;
  border: .5px solid var(--separator, rgba(60,60,67,.2));
  border-radius: 14px;
  background: var(--bg-secondary, #fff);
  box-shadow: 0 12px 30px rgba(0,0,0,.16);
}
.ai-feature-menu-title {
  padding: 6px 10px 4px;
  font-size: 11px;
  color: var(--label-3, rgba(60,60,67,.38));
}
.ai-feature-item {
  display: flex; align-items: center; gap: 8px; width: 100%;
  padding: 9px 10px; border: 0; border-radius: 10px;
  background: transparent; color: var(--label, #000);
  font-size: 13px; text-align: left; cursor: pointer;
}
.ai-feature-item:hover:not(:disabled) { background: var(--fill-quaternary, rgba(116,116,128,.1)); }
.ai-feature-item:disabled { color: var(--label-3, rgba(60,60,67,.38)); cursor: not-allowed; }
.ai-feature-label { flex: 1; }
.ai-feature-hint { font-size: 11px; color: var(--label-3, rgba(60,60,67,.38)); white-space: nowrap; }
.ai-menu-enter-active, .ai-menu-leave-active { transition: opacity .16s ease, transform .16s ease; }
.ai-menu-enter-from, .ai-menu-leave-to { opacity: 0; transform: translateY(-6px); }

/* 奶团子气泡：不抢焦点，点到就收，几秒后自动消失 */
.ai-bun-bubble {
  position: absolute; right: 0; bottom: calc(100% + 10px); z-index: 1;
  display: flex; align-items: flex-start; gap: 6px;
  width: max-content; max-width: min(230px, 62vw);
  padding: 9px 10px 9px 12px;
  border: .5px solid var(--separator, rgba(60,60,67,.2));
  border-radius: 14px;
  background: var(--bg-secondary, #fff);
  color: var(--label, #000);
  font-size: 13px; line-height: 1.35;
  box-shadow: 0 10px 24px rgba(0,0,0,.14);
  cursor: pointer;
}
.ai-bun-bubble.is-below { bottom: auto; top: calc(100% + 10px); }
.ai-bun-bubble.is-left { right: auto; left: 0; }
.ai-bun-bubble-text { flex: 1; }
.ai-bun-bubble-close {
  flex: 0 0 auto; width: 18px; height: 18px; padding: 0; margin-top: -2px;
  border: 0; border-radius: 50%; background: transparent;
  color: var(--label-3, rgba(60,60,67,.38)); font-size: 14px; line-height: 1; cursor: pointer;
}
.ai-bun-bubble-close:hover { background: var(--fill-quaternary, rgba(116,116,128,.14)); }
.ai-bun-bubble-enter-active, .ai-bun-bubble-leave-active { transition: opacity .18s ease, transform .18s ease; }
.ai-bun-bubble-enter-from, .ai-bun-bubble-leave-to { opacity: 0; transform: translateY(6px) scale(.96); }
@media (prefers-reduced-motion: reduce) {
  .ai-bun-bubble-enter-active, .ai-bun-bubble-leave-active,
  .ai-menu-enter-active, .ai-menu-leave-active { transition: none; }
}
/* 常驻奶团子：可拖动，位置由内联 left/top 控制，边界在 JS 里夹住 */
.ai-mini-draggable-bun {
  position: fixed;
  z-index: 2500;
  width: 64px;
  height: 64px;
  display: grid;
  place-items: center;
  border-radius: 50%;
  cursor: grab;
  touch-action: none;
  user-select: none;
  -webkit-user-select: none;
  -webkit-tap-highlight-color: transparent;
  transition: transform .18s cubic-bezier(.2,.8,.2,1);
  filter: drop-shadow(0 10px 20px rgba(0, 0, 0, .16));
}

.ai-mini-draggable-bun:hover {
  transform: scale(1.05);
}

.ai-mini-draggable-bun:active,
.ai-mini-draggable-bun.is-dragging {
  transform: scale(1.08);
  cursor: grabbing;
  transition: none;
}

.ai-mini-draggable-bun:focus-visible {
  outline: 2px solid var(--blue, #007aff);
  outline-offset: 2px;
}
@media (max-width: 600px) {
  .ai-panel { top:0; right:0; bottom:0; left:0; width:calc(100vw - 12px); height:calc(100vh - 24px); max-height:calc(100vh - 24px); border-radius:20px; }
}
</style>
