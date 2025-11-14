const LANG_KEY = 'lang';

const hasStorage = () => typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';

export function getLang(): string {
  if (!hasStorage()) {
    return 'en';
  }

  try {
    return localStorage.getItem(LANG_KEY) || 'en';
  } catch {
    return 'en';
  }
}

export function setLang(lang: string): void {
  if (!hasStorage()) {
    return;
  }

  try {
    localStorage.setItem(LANG_KEY, lang);
  } catch {
    // ignore
  }
}
