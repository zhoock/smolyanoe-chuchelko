// src/app/providers/lang/LangProvider.tsx
import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { getLang as getLangLS, setLang as setLangLS } from '@shared/lib/lang';
import { setCurrentLang } from '@shared/model/lang';

type LangCtx = { lang: string; setLang: (lang: string) => void };

const LangContext = createContext<LangCtx | null>(null);

export function LangProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState(() => {
    const initialLang = getLangLS() || 'en';
    setCurrentLang(initialLang);
    return initialLang;
  });

  const setLang = useCallback((nextLang: string) => {
    setLangLS(nextLang);
    setCurrentLang(nextLang);
    setLangState(nextLang);
  }, []);

  const value = useMemo(() => ({ lang, setLang }), [lang, setLang]);

  return <LangContext.Provider value={value}>{children}</LangContext.Provider>;
}

export function useLang() {
  const ctx = useContext(LangContext);
  if (!ctx) {
    throw new Error('useLang must be used within <LangProvider>');
  }
  return ctx;
}
