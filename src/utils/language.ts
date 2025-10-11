// utils/language.ts
const LANG_KEY = 'lang';

export function getLang(): string {
  return localStorage.getItem(LANG_KEY) || 'en';
}

export function setLang(lang: string): void {
  localStorage.setItem(LANG_KEY, lang);
}
