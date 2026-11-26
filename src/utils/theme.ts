export type ThemePreference = 'system' | 'light' | 'dark';

const STORAGE_KEY = 'color-scheme';

export function getStoredTheme(): ThemePreference {
  try {
    const val = localStorage.getItem(STORAGE_KEY);
    if (val === 'light' || val === 'dark') {
      return val;
    }
  } catch {
    // ignore storage access errors
  }
  return 'system';
}

export function applyTheme(theme: ThemePreference): void {
  const meta = document.querySelector('meta[name="color-scheme"]');
  const content = theme === 'system' ? 'light dark' : theme;
  if (meta) {
    meta.setAttribute('content', content);
  }

  try {
    if (theme === 'system') {
      localStorage.removeItem(STORAGE_KEY);
    } else {
      localStorage.setItem(STORAGE_KEY, theme);
    }
  } catch {
    // ignore storage access errors
  }
}

export function getSystemPrefersDark(): boolean {
  if (typeof window === 'undefined' || !window.matchMedia) return false;
  return window.matchMedia('(prefers-color-scheme: dark)').matches;
}
