export const LOGIN_THEMES = [
  { id: 'paper', labelKey: 'loginThemePaper' },
  { id: 'centered', labelKey: 'loginThemeCentered' },
  { id: 'fresh', labelKey: 'loginThemeFresh' },
  { id: 'gala', labelKey: 'loginThemeGala' }
];

export const DEFAULT_LOGIN_THEME = 'paper';

export function normalizeLoginTheme(value) {
  return LOGIN_THEMES.some(item => item.id === value) ? value : DEFAULT_LOGIN_THEME;
}
