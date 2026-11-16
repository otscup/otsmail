const SCRIPT_URL = 'https://challenges.cloudflare.com/turnstile/v0/api.js'
const SCRIPT_SELECTOR = 'script[src*="challenges.cloudflare.com/turnstile/v0/api.js"]'

let loadPromise = null

export function loadTurnstileScript() {
  if (window.turnstile?.render) return Promise.resolve(window.turnstile)
  if (loadPromise) return loadPromise

  loadPromise = new Promise((resolve, reject) => {
    // index.html 已声明脚本时只等待它，不能删除或再插入一份 SDK。
    const script = document.querySelector(SCRIPT_SELECTOR) || document.createElement('script')

    const cleanup = () => {
      clearTimeout(timeout)
      script.removeEventListener('load', handleLoad)
      script.removeEventListener('error', handleError)
    }

    const handleLoad = () => {
      cleanup()
      if (window.turnstile?.render) {
        resolve(window.turnstile)
      } else {
        script.remove()
        reject(new Error('Turnstile API is unavailable after loading'))
      }
    }

    const handleError = () => {
      cleanup()
      script.remove()
      reject(new Error('Turnstile script loading failed'))
    }

    const timeout = setTimeout(() => {
      cleanup()
      script.remove()
      reject(new Error('Turnstile script loading timed out'))
    }, 15000)

    script.addEventListener('load', handleLoad)
    script.addEventListener('error', handleError)

    if (!script.isConnected) {
      script.src = SCRIPT_URL
      script.async = true
      script.defer = true
      document.head.appendChild(script)
    }
  }).finally(() => {
    loadPromise = null
  })

  return loadPromise
}
