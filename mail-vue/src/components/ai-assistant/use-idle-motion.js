import { ref } from 'vue'

// 单次动作时长与设计稿一致（A 2.2s / B 3.4s / C 1.8s）
export const IDLE_MOTION_DURATION = { chase: 2200, sprint: 3400, orbit: 1800 }
// 触发间隔 6～12 分钟，每轮重新随机，避免看出固定节拍
export const IDLE_MIN_DELAY = 6 * 60 * 1000
export const IDLE_SPAN = 6 * 60 * 1000

/**
 * 奶团子空闲小动作调度：
 * - 三个动作洗牌轮换，一轮内不重复，且不会连续两次相同
 * - 只在页面可见时计时；切后台立即停表并中止当前动作，回到前台重新计时
 * - 由 canPlay 决定是否允许（气泡可见、正在拖动时返回 false）
 * - reduce 动效偏好下直接跳过
 */
export function useIdleMotion(options = {}) {
  const {
    canPlay = () => true,
    minDelay = IDLE_MIN_DELAY,
    span = IDLE_SPAN,
    durations = IDLE_MOTION_DURATION
  } = options

  const motion = ref('')
  let timer = null
  let endTimer = null
  let bag = []
  let last = ''

  function prefersReducedMotion() {
    return !!window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches
  }

  function nextMotion() {
    if (!bag.length) {
      const shuffled = ['chase', 'sprint', 'orbit']
      for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1))
        ;[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
      }
      // 新的一轮不要把上一轮最后一个动作排在最前面
      if (shuffled[0] === last) shuffled.push(shuffled.shift())
      bag = shuffled
    }
    return bag.shift()
  }

  function schedule() {
    if (timer) clearTimeout(timer)
    timer = setTimeout(tryStart, minDelay + Math.random() * span)
  }

  function tryStart() {
    timer = null
    if (document.visibilityState !== 'visible' || !canPlay() || prefersReducedMotion()) {
      schedule()
      return
    }
    const next = nextMotion()
    last = next
    motion.value = next
    // 用时长兜底收尾，动画事件没触发也不会留下飞机/尾迹
    endTimer = setTimeout(() => {
      endTimer = null
      motion.value = ''
      schedule()
    }, durations[next])
  }

  function stop() {
    if (endTimer) {
      clearTimeout(endTimer)
      endTimer = null
    }
    motion.value = ''
  }

  function onVisibilityChange() {
    if (document.visibilityState === 'visible') {
      schedule()
    } else {
      if (timer) {
        clearTimeout(timer)
        timer = null
      }
      stop()
    }
  }

  function bind() {
    document.addEventListener('visibilitychange', onVisibilityChange)
    schedule()
  }

  function unbind() {
    document.removeEventListener('visibilitychange', onVisibilityChange)
    if (timer) clearTimeout(timer)
    if (endTimer) clearTimeout(endTimer)
    timer = null
    endTimer = null
    motion.value = ''
  }

  return { motion, schedule, stop, tryStart, nextMotion, bind, unbind }
}
