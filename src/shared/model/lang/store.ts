// src/shared/model/lang/store.ts

export let currentLang = 'ru';

export function setCurrentLang(next: string) {
  currentLang = next;
}
