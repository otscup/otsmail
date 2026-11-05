export const HOME_SKINS = [
  { id: 'paper', labelKey: 'skinPaper', descKey: 'skinPaperDesc', loginTheme: 'paper' },
  { id: 'fresh', labelKey: 'skinFresh', descKey: 'skinFreshDesc', loginTheme: 'fresh' },
  { id: 'gala', labelKey: 'skinGala', descKey: 'skinGalaDesc', loginTheme: 'gala' }
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
  // 弹层里的 TinyMCE iframe 不会跟随 CSS 变量重绘，需要这个事件同步刷新。
  window.dispatchEvent(new CustomEvent('otsmail:skin', { detail: { skin: id } }))
  return id
}
