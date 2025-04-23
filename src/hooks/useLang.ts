// hooks/useLang.ts

import { useEffect, useState } from 'react';
import { getLang, setLang } from '../utils/language';

export function useLang() {
  const [lang, setLangState] = useState(getLang());

  function changeLang(newLang: string) {
    setLang(newLang);
    setLangState(newLang);
  }

  useEffect(() => {
    const storedLang = getLang();
    if (storedLang !== lang) {
      setLangState(storedLang);
    }
  }, []);

  return { lang, changeLang };
}
