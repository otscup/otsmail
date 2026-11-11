<template>
  <div
    ref="bunRoot"
    class="cream-bun-container"
    :class="{ 'is-blinking': isBlinking, 'is-motion': !!motion, ['is-' + motion]: !!motion }"
    :style="containerStyle"
  >
    <svg
      :width="size"
      :height="size"
      viewBox="0 0 100 90"
      class="cream-bun-svg"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <!-- 只用于左上柔光，边缘完全淡出（不改变本体颜色） -->
        <radialGradient :id="`${uid}-shine`" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stop-color="#FFFFFF" stop-opacity=".62" />
          <stop offset="58%" stop-color="#FFFFFF" stop-opacity=".16" />
          <stop offset="100%" stop-color="#FFFFFF" stop-opacity="0" />
        </radialGradient>
        <!-- 外轮廓：奶油色系，上缘提亮、下缘略深，不用橙褐 -->
        <linearGradient :id="`${uid}-rim`" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#FBF0DC" stop-opacity=".95" />
          <stop offset="100%" stop-color="#E6D2AE" stop-opacity=".9" />
        </linearGradient>
        <!-- 底部内阴影：同属奶油色系的低透明度暗部，用来交代体积，不改变本体色相 -->
        <radialGradient :id="`${uid}-shade`" cx="50%" cy="100%" r="76%">
          <stop offset="0%" stop-color="#C9A874" stop-opacity=".3" />
          <stop offset="60%" stop-color="#C9A874" stop-opacity=".12" />
          <stop offset="100%" stop-color="#C9A874" stop-opacity="0" />
        </radialGradient>
        <clipPath :id="`${uid}-clip`">
          <path :d="BODY_PATH" />
        </clipPath>
      </defs>

      <!-- 底部接触阴影：中性偏暖的灰，不带橙调。阴影不参与空闲动作，动作只动身体 -->
      <ellipse cx="50" cy="86" rx="33" ry="4.6" fill="rgba(120, 90, 50, .14)" />
      <ellipse cx="50" cy="84.6" rx="25" ry="3" fill="rgba(96, 72, 38, .16)" />

      <g class="bun-figure">
        <g class="bun-jump">

      <!-- 头部主体：单一奶油白 #FDF0D8，不做渐变 -->
      <path
        :d="BODY_PATH"
        class="bun-body"
        fill="#FDF0D8"
        :stroke="`url(#${uid}-rim)`"
        stroke-width="1.8"
      />

      <!-- 内部光影：底部暗部 + 左上柔光，都裁在轮廓里，不碰五官 -->
      <g :clip-path="`url(#${uid}-clip)`">
        <ellipse cx="50" cy="82" rx="40" ry="16" :fill="`url(#${uid}-shade)`" />
        <ellipse cx="36" cy="33" rx="19" ry="11" :fill="`url(#${uid}-shine)`"
                 transform="rotate(-22 36 33)" />
      </g>

      <!-- 左眼眼白（不可见底）与 黑色圆点眼睛 -->
      <circle
        :cx="36 + eyeOffset.x"
        :cy="48 + eyeOffset.y"
        r="4.2"
        fill="#1e293b"
        class="bun-eye"
      />

      <!-- 右眼黑色圆点眼睛 -->
      <circle
        :cx="64 + eyeOffset.x"
        :cy="48 + eyeOffset.y"
        r="4.2"
        fill="#1e293b"
        class="bun-eye"
      />

      <!-- 微微一笑（柔和弧线嘴巴） -->
      <path
        d="M 43 56 Q 50 63 57 56"
        stroke="#1e293b"
        stroke-width="2.5"
        stroke-linecap="round"
        fill="none"
        class="bun-mouth"
      />
        </g>
      </g>
    </svg>

    <!-- 空闲小动作：纸飞机与尾迹只在动作播放期间存在，播完由外层移除 -->
    <div v-if="motion" class="bun-motion" aria-hidden="true">
      <i class="motion-trail t1"></i>
      <i class="motion-trail t2"></i>
      <i class="motion-trail t3"></i>
      <div class="motion-plane">
        <i class="motion-speed s1"></i>
        <i class="motion-speed s2"></i>
        <i class="motion-speed s3"></i>
        <svg viewBox="0 0 24 24">
          <path class="wing" d="M2.5 11.9 21.5 3 14.8 21 11.4 13.3 2.5 11.9Z"/>
          <path class="crease" d="M11.4 13.3 21.5 3"/>
        </svg>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted, onUnmounted, ref } from 'vue'

const props = defineProps({
  size: {
    type: Number,
    default: 48
  },
  // 空闲小动作：chase（追纸飞机）/ sprint（起飞冲刺）/ orbit（原地环绕），空字符串为常态
  motion: {
    type: String,
    default: ''
  }
})

// 多实例（顶栏 / 悬浮球 / 详情页）同时存在，渐变 id 必须各自唯一，否则 url(#id) 会串用
const uid = `bun${Math.random().toString(36).slice(2, 7)}`
const BODY_PATH = `M 50 12
  C 74 12, 88 38, 92 64
  C 95 80, 84 84, 50 84
  C 16 84, 5 80, 8 64
  C 12 38, 26 12, 50 12 Z`

const bunRoot = ref(null)
const mousePos = ref({ x: 0, y: 0 })
const isHoverOrNear = ref(false)
const eyeOffset = ref({ x: 0, y: 0 })
const headRotate = ref({ deg: 0 })
const headTranslate = ref({ x: 0, y: 0 })
const isBlinking = ref(false)
let blinkTimer = null

// 容器轻微平移 + 头部轻微旋转（最多 6 度）
const containerStyle = computed(() => {
  return {
    width: `${props.size}px`,
    height: `${props.size}px`,
    transform: `translate(${headTranslate.value.x}px, ${headTranslate.value.y}px) rotate(${headRotate.value.deg}deg)`,
    transition: isHoverOrNear.value
      ? 'transform 0.12s ease-out'
      : 'transform 0.4s ease-out'
  }
})

function onPointerMove(e) {
  const clientX = e.clientX ?? (e.touches ? e.touches[0].clientX : 0)
  const clientY = e.clientY ?? (e.touches ? e.touches[0].clientY : 0)
  mousePos.value = { x: clientX, y: clientY }

  if (!bunRoot.value) return
  const rect = bunRoot.value.getBoundingClientRect()
  const centerX = rect.left + rect.width / 2
  const centerY = rect.top + rect.height / 2

  const dx = clientX - centerX
  const dy = clientY - centerY
  const dist = Math.hypot(dx, dy)

  // 靠近触发阈值（350px 范围内产生交互反应，离远后平缓回正盯屏幕）
  const activeRadius = 350
  if (dist < activeRadius) {
    isHoverOrNear.value = true
    const factor = Math.min(1, Math.max(0, 1 - dist / activeRadius))
    const angle = Math.atan2(dy, dx)

    // 眼睛最大移动幅度为 3.5px
    const maxEyeMove = 3.5
    eyeOffset.value = {
      x: Math.cos(angle) * maxEyeMove * factor,
      y: Math.sin(angle) * maxEyeMove * factor
    }

    // 头部转动：最大 6 度
    const maxDeg = 6
    headRotate.value = {
      deg: (dx / activeRadius) * maxDeg
    }

    // 头部轻微位移：最大 3px
    headTranslate.value = {
      x: (dx / activeRadius) * 3,
      y: (dy / activeRadius) * 2
    }
  } else {
    // 离远后回正，正常注视正前方
    resetPosture()
  }
}

function onPointerLeave() {
  resetPosture()
}

function resetPosture() {
  isHoverOrNear.value = false
  eyeOffset.value = { x: 0, y: 0 }
  headRotate.value = { deg: 0 }
  headTranslate.value = { x: 0, y: 0 }
}

// 随机眨眼逻辑：2～5 秒眨一次，闭眼约 140 毫秒
function startBlinkCycle() {
  const delay = 2000 + Math.random() * 3000
  blinkTimer = setTimeout(() => {
    isBlinking.value = true
    setTimeout(() => {
      isBlinking.value = false
      startBlinkCycle()
    }, 140)
  }, delay)
}

onMounted(() => {
  window.addEventListener('mousemove', onPointerMove, { passive: true })
  window.addEventListener('touchmove', onPointerMove, { passive: true })
  document.addEventListener('mouseleave', onPointerLeave)
  startBlinkCycle()
})

onUnmounted(() => {
  window.removeEventListener('mousemove', onPointerMove)
  window.removeEventListener('touchmove', onPointerMove)
  document.removeEventListener('mouseleave', onPointerLeave)
  if (blinkTimer) clearTimeout(blinkTimer)
})
</script>

<style scoped>
.cream-bun-container {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  pointer-events: auto;
  user-select: none;
  transform-origin: center 80%;
  flex-shrink: 0;
}

.cream-bun-svg {
  display: block;
  overflow: visible;
}

/* 固定暖奶油色（不跟随皮肤主题、不分深浅色），立体感来自静态内阴影与中性偏暖投影 */
.bun-body {
  filter: drop-shadow(0 6px 12px rgba(120, 92, 56, .2));
}

/* 眨眼动画：上下扁平缩放到一条缝 */
.bun-eye {
  transform-origin: center;
  transition: transform 0.08s ease-out;
}

.is-blinking .bun-eye {
  transform: scaleY(0.1);
}

/* ---------- 空闲小动作（A 追纸飞机 / B 起飞冲刺 / C 原地环绕） ---------- */
/* 动作只作用在身体分组上，底部接触阴影与容器位置、尺寸、拖拽区域都不变 */
.bun-motion {
  position: absolute;
  inset: 0;
  pointer-events: none;
}

.bun-figure,
.bun-jump {
  transform-box: fill-box;
  transform-origin: 50% 100%;
}

.motion-plane {
  position: absolute;
  left: 0;
  top: 0;
  width: 12px;
  height: 12px;
  z-index: 2;
}

.motion-plane svg {
  display: block;
  width: 100%;
  height: 100%;
  overflow: visible;
}

.motion-plane .wing {
  fill: var(--rd-accent, #0a84ff);
}

.motion-plane .crease {
  fill: none;
  stroke: var(--rd-panel, #ffffff);
  stroke-width: 1.7;
  stroke-linecap: round;
}

.motion-trail {
  position: absolute;
  left: 0;
  top: 0;
  width: 2.6px;
  height: 2.6px;
  border-radius: 50%;
  background: var(--rd-accent-2, #6d5ce7);
  opacity: 0.45;
  z-index: 1;
}

.motion-trail.t2 {
  animation-delay: -0.07s;
  opacity: 0.28;
}

.motion-trail.t3 {
  animation-delay: -0.14s;
  opacity: 0.16;
  width: 2.2px;
  height: 2.2px;
}

.motion-speed {
  position: absolute;
  right: 100%;
  top: 50%;
  width: 10px;
  height: 1.5px;
  border-radius: 2px;
  background: var(--rd-accent-2, #6d5ce7);
  transform-origin: 100% 50%;
  opacity: 0;
}

.motion-speed.s2 {
  top: calc(50% - 3px);
  width: 7px;
}

.motion-speed.s3 {
  top: calc(50% + 3px);
  width: 6px;
}

/* A 追纸飞机：飞机绕椭圆巡航，奶团子左右追赶 */
.is-chase .bun-figure {
  animation: bun-chase-x 2.2s ease-in-out both;
}

.is-chase .bun-jump {
  animation: bun-hop-a 2.2s cubic-bezier(0.3, 0.1, 0.4, 1) both;
}

.is-chase .motion-plane,
.is-chase .motion-trail {
  offset-path: path("M50 26a22 11 0 1 0-44 0a22 11 0 1 0 44 0");
  offset-rotate: auto;
  animation: bun-orbit 2.2s linear both;
}

/* B 起飞冲刺：飞机冲出画面，奶团子跳三下后摊平 */
.is-sprint .bun-jump {
  animation: bun-hop-b 3.4s cubic-bezier(0.3, 0.1, 0.4, 1) both;
}

.is-sprint .motion-trail {
  display: none;
}

.is-sprint .motion-plane {
  left: 4px;
  top: 24px;
  animation: bun-plane-run 3.4s linear both;
}

.is-sprint .motion-speed {
  animation: bun-speed-flash 3.4s linear both;
}

/* C 原地环绕：小椭圆绕一圈，奶团子轻轻点两下 */
.is-orbit .bun-jump {
  animation: bun-hop-c 1.8s cubic-bezier(0.35, 0.1, 0.4, 1) both;
}

.is-orbit .motion-plane {
  width: 11px;
  height: 11px;
}

.is-orbit .motion-plane,
.is-orbit .motion-trail {
  offset-path: path("M48 28a20 9 0 1 0-40 0a20 9 0 1 0 40 0");
  offset-rotate: auto;
  animation: bun-orbit 1.8s linear both;
}

@keyframes bun-orbit {
  from {
    offset-distance: 0%;
  }
  to {
    offset-distance: 100%;
  }
}

/* 以下位移/缩放使用 SVG 用户单位（viewBox 100×90），随 size 等比缩放 */
@keyframes bun-chase-x {
  0%, 100% { transform: translateX(0); }
  12.5% { transform: translateX(8px); }
  25% { transform: translateX(12px); }
  37.5% { transform: translateX(3px); }
  50% { transform: translateX(-9px); }
  62.5% { transform: translateX(-12px); }
  75% { transform: translateX(-3px); }
  87.5% { transform: translateX(6px); }
}

@keyframes bun-hop-a {
  0% { transform: translateY(0) scale(1, 1) rotate(0deg); }
  6% { transform: translateY(-12px) scale(0.97, 1.04) rotate(-4deg); }
  13% { transform: translateY(-15px) scale(1, 1) rotate(-2deg); }
  21% { transform: translateY(0) scale(1.06, 0.92) rotate(2deg); }
  26% { transform: translateY(0) scale(1, 1) rotate(0deg); }
  50% { transform: translateY(0) scale(1, 1) rotate(0deg); }
  55% { transform: translateY(-8px) scale(0.98, 1.03) rotate(4deg); }
  62% { transform: translateY(-10px) scale(1, 1) rotate(2deg); }
  70% { transform: translateY(0) scale(1.05, 0.93) rotate(-2deg); }
  76%, 100% { transform: translateY(0) scale(1, 1) rotate(0deg); }
}

@keyframes bun-hop-b {
  0%, 7% { transform: translateY(0) scale(1, 1) rotate(0deg); }
  10% { transform: translateY(0) scale(1.07, 0.9) rotate(0deg); }
  14% { transform: translateY(-14px) scale(0.96, 1.05) rotate(-3deg); }
  18% { transform: translateY(0) scale(1.07, 0.9) rotate(2deg); }
  22% { transform: translateY(0) scale(1, 1) rotate(0deg); }
  25% { transform: translateY(0) scale(1.05, 0.93) rotate(0deg); }
  29% { transform: translateY(-9px) scale(0.98, 1.03) rotate(5deg); }
  33% { transform: translateY(0) scale(1.06, 0.92) rotate(3deg); }
  37% { transform: translateY(0) scale(1, 1) rotate(0deg); }
  40% { transform: translateY(0) scale(1.04, 0.94) rotate(0deg); }
  44% { transform: translateY(-6px) scale(0.99, 1.02) rotate(4deg); }
  48% { transform: translateY(0) scale(1.06, 0.9) rotate(2deg); }
  52% { transform: translateY(1px) scale(1.09, 0.87) rotate(-2deg); }
  60% { transform: translateY(2px) scale(1.2, 0.78) rotate(-5deg); }
  68% { transform: translateY(3px) scale(1.16, 0.8) rotate(-6deg); }
  76% { transform: translateY(2px) scale(1.08, 0.9) rotate(-3deg); }
  88%, 100% { transform: translateY(0) scale(1, 1) rotate(0deg); }
}

@keyframes bun-hop-c {
  0%, 8% { transform: translateY(0) scale(1, 1); }
  14% { transform: translateY(-5px) scale(0.99, 1.02); }
  22% { transform: translateY(0) scale(1.04, 0.95); }
  30%, 58% { transform: translateY(0) scale(1, 1); }
  66% { transform: translateY(0) scale(1.04, 0.95); }
  72% { transform: translateY(-4px) scale(0.99, 1.01); }
  80% { transform: translateY(0) scale(1.03, 0.96); }
  88%, 100% { transform: translateY(0) scale(1, 1); }
}

@keyframes bun-plane-run {
  0% { transform: translate(0, 0) rotate(0deg); opacity: 1; animation-timing-function: cubic-bezier(0.4, 0, 0.6, 1); }
  9% { transform: translate(0, -2px) rotate(-2deg); opacity: 1; animation-timing-function: cubic-bezier(0.55, 0, 0.95, 0.4); }
  30% { transform: translate(40px, -8px) rotate(-12deg); opacity: 1; }
  33% { transform: translate(44px, -9px) rotate(-12deg); opacity: 0; }
  55% { transform: translate(-44px, -3px) rotate(-4deg); opacity: 0; }
  58% { transform: translate(-5px, -1px) rotate(-2deg); opacity: 0; }
  63% { transform: translate(-1px, 0) rotate(0deg); opacity: 1; }
  78%, 100% { transform: translate(0, 0) rotate(0deg); opacity: 1; }
}

@keyframes bun-speed-flash {
  0%, 9% { opacity: 0; transform: scaleX(0.3); }
  15% { opacity: 0.6; transform: scaleX(1); }
  28% { opacity: 0.45; transform: scaleX(0.9); }
  33%, 100% { opacity: 0; transform: scaleX(0.3); }
}

/* 降低打扰：不播动作，保留静态构图 */
@media (prefers-reduced-motion: reduce) {
  .bun-figure,
  .bun-jump,
  .motion-plane,
  .motion-trail,
  .motion-speed {
    animation: none !important;
  }
}
</style>
