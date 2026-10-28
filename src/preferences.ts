import { backgrounds, themeTokens, type Background } from './themes';

export interface Preferences { fontSize: 'small' | 'normal' | 'large'; density: 'compact' | 'comfortable'; teachers: boolean; background: Background }
const key = 'rhythm.appearance.v1';
const defaults: Preferences = { fontSize: 'normal', density: 'compact', teachers: true, background: 'black' };
export function readPreferences(): Preferences {
  try {
    const saved = JSON.parse(localStorage.getItem(key) ?? '{}');
    return {
      fontSize: ['small', 'normal', 'large'].includes(saved.fontSize) ? saved.fontSize : defaults.fontSize,
      density: ['compact', 'comfortable'].includes(saved.density) ? saved.density : defaults.density,
      teachers: typeof saved.teachers === 'boolean' ? saved.teachers : defaults.teachers,
      background: backgrounds.some(item => item.id === saved.background) ? saved.background : defaults.background,
    };
  } catch { return { ...defaults }; }
}
export let preferences = readPreferences();
export function applyPreferences() {
  for (const [name, value] of Object.entries(themeTokens(preferences.background))) document.documentElement.style.setProperty(name, value);
  document.documentElement.dataset.background = preferences.background;
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', themeTokens(preferences.background)['--bg']);
  document.documentElement.style.setProperty('--font-scale', String({ small: 0.9, normal: 1, large: 1.2 }[preferences.fontSize]));
  document.documentElement.dataset.density = preferences.density;
  document.documentElement.dataset.teachers = String(preferences.teachers);
}
export function updatePreferences(changes: Partial<Preferences>) {
  const updated = { ...preferences, ...changes };
  localStorage.setItem(key, JSON.stringify(updated));
  preferences = updated;
  applyPreferences();
}
