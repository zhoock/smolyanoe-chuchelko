// src/contexts/lang.tsx
import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { getLang as getLangLS, setLang as setLangLS } from '@shared/lib/lang';

// в контексте лежит один объект с двумя полями:
// lang: строка (текущий язык),
// setLang: функция (как этот язык поменять)
type LangCtx = { lang: string; setLang: (l: string) => void };

const LangContext = createContext<LangCtx | null>(null);

export function LangProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState(() => getLangLS() || 'en'); // читаем из localStorage (если хочешь)

  // Функция смены языка
  // useCallback, чтобы ссылка на функцию была стабильной между рендерами
  const setLang = useCallback((l: string) => {
    setLangLS(l); // сохраняем в localStorage (если хочешь)
    setLangState(l); // обновляем контекст
  }, []);

  const value = useMemo(() => ({ lang, setLang }), [lang, setLang]);
  return <LangContext.Provider value={value}>{children}</LangContext.Provider>;
}

export function useLang() {
  const ctx = useContext(LangContext);
  if (!ctx) throw new Error('useLang must be used within <LangProvider>'); // защита от неправильного использования
  return ctx;
}
