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
  return id
}
