import { ReactNode, useCallback } from 'react';

import { useAppDispatch } from '@shared/lib/hooks/useAppDispatch';
import { useAppSelector } from '@shared/lib/hooks/useAppSelector';
import {
  langActions,
  selectCurrentLang,
  type SupportedLang,
} from '@shared/model/lang';

export function LangProvider({ children }: { children: ReactNode }) {
  return <>{children}</>;
}

export function useLang() {
  const dispatch = useAppDispatch();
  const lang = useAppSelector(selectCurrentLang);

  const setLang = useCallback(
    (nextLang: SupportedLang) => {
      dispatch(langActions.setLang(nextLang));
    },
    [dispatch]
  );

  return { lang, setLang };
}
