// language.ts

import { useState } from 'react';

let currentLang = 'en';

export function getLang() {
  return currentLang;
}

export function setLang(lang: string) {
  currentLang = lang;
}
