export const HOME_SKINS = [
  { id: 'paper', labelKey: 'skinPaper', descKey: 'skinPaperDesc', loginTheme: 'paper' },
  { id: 'fresh', labelKey: 'skinFresh', descKey: 'skinFreshDesc', loginTheme: 'fresh' },
  { id: 'gala', labelKey: 'skinGala', descKey: 'skinGalaDesc', loginTheme: 'gala' },
  { id: 'classic', labelKey: 'skinClassic', descKey: 'skinClassicDesc', loginTheme: 'centered' }
]

export const DEFAULT_HOME_SKIN = 'paper'
const STORAGE_KEY = 'otsmail_skin'

export function getSavedSkin() {
  const value = localStorage.getItem(STORAGE_KEY)
  return HOME_SKINS.some(item => item.id === value) ? value : null
}

export function getStoredSkin() {
  return getSavedSkin() || DEFAULT_HOME_SKIN
}

export function loginThemeForSkin(skin) {
  return HOME_SKINS.find(item => item.id === skin)?.loginTheme || 'paper'
}

export function applySkin(skin = getStoredSkin(), persist = true) {
  const id = HOME_SKINS.some(item => item.id === skin) ? skin : DEFAULT_HOME_SKIN
  if (persist) localStorage.setItem(STORAGE_KEY, id)
  document.documentElement.dataset.skin = id
  syncFavicon()
  // 弹层里的 TinyMCE iframe 不会跟随 CSS 变量重绘，需要这个事件同步刷新。
  window.dispatchEvent(new CustomEvent('otsmail:skin', { detail: { skin: id } }))
  return id
}

// 浏览器标签页图标是静态 PNG，不跟 CSS 变量；用当前皮肤强调色生成同款信封图标。
function syncFavicon() {
  const accent = getComputedStyle(document.documentElement).getPropertyValue('--rd-accent').trim() || '#2454d6'
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect width="32" height="32" rx="9" fill="${accent}"/><path d="M7.5 11h17v10h-17zM8 11.5l8 6 8-6" fill="none" stroke="#fff" stroke-width="1.8" stroke-linejoin="round"/></svg>`
  let link = document.querySelector('link[rel="icon"]')
  if (!link) {
    link = document.createElement('link')
    link.rel = 'icon'
    document.head.appendChild(link)
  }
  link.type = 'image/svg+xml'
  link.href = 'data:image/svg+xml,' + encodeURIComponent(svg)
}
