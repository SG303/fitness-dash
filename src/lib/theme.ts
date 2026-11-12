/** Colour scheme: follow the device ("system") or force light or dark. Stored on the device. */
export type Theme = 'system' | 'light' | 'dark';

const KEY = 'fitness-dash:theme';
const THEME_COLOR = { light: '#f3f4f5', dark: '#121416' };
const darkQuery = typeof matchMedia === 'function' ? matchMedia('(prefers-color-scheme: dark)') : null;

export function loadTheme(): Theme {
  try {
    const stored = localStorage.getItem(KEY);
    return stored === 'light' || stored === 'dark' ? stored : 'system';
  } catch {
    return 'system';
  }
}

export function saveTheme(theme: Theme) {
  try {
    if (theme === 'system') localStorage.removeItem(KEY);
    else localStorage.setItem(KEY, theme);
  } catch {
    // Without storage the choice only lasts until the app is closed.
  }
}

/** Sets data-theme on <html> (read by app.css) and the browser bar colour. */
export function applyTheme(theme: Theme) {
  const root = document.documentElement;
  if (theme === 'system') delete root.dataset.theme;
  else root.dataset.theme = theme;
  const effective = theme === 'system' ? (darkQuery?.matches ? 'dark' : 'light') : theme;
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', THEME_COLOR[effective]);
}

/** Re-applies "system" when the device switches between light and dark. */
export function onSystemChange(callback: () => void): () => void {
  darkQuery?.addEventListener('change', callback);
  return () => darkQuery?.removeEventListener('change', callback);
}
