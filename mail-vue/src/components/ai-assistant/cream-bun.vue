<template>
  <div
    ref="bunRoot"
    class="cream-bun-container"
    :class="{ 'is-blinking': isBlinking }"
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

      <!-- 底部接触阴影：中性偏暖的灰，不带橙调 -->
      <ellipse cx="50" cy="86" rx="33" ry="4.6" fill="rgba(120, 90, 50, .14)" />
      <ellipse cx="50" cy="84.6" rx="25" ry="3" fill="rgba(96, 72, 38, .16)" />

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
    </svg>
  </div>
</template>

<script setup>
import { computed, onMounted, onUnmounted, ref } from 'vue'

const props = defineProps({
  size: {
    type: Number,
    default: 48
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
</style>
