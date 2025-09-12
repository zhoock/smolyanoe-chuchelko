// src/state/langStore.ts

// Простейший стор для хранения текущего языка
// (вместо Redux или MobX, чтобы не тянуть лишние зависимости)
export let currentLang = 'ru';
export function setCurrentLang(next: string) {
  currentLang = next;
}
