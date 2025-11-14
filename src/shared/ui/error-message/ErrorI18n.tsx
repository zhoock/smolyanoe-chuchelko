// src/shared/ui/error-message/ErrorI18n.tsx
import { useEffect } from 'react';
import { useLang } from '@app/providers/lang';
import { useAppDispatch } from '@shared/lib/hooks/useAppDispatch';
import { useAppSelector } from '@shared/lib/hooks/useAppSelector';
import {
  fetchUiDictionary,
  selectUiDictionaryStatus,
  selectUiDictionaryFirst,
} from '@shared/model/uiDictionary';
import { ErrorMessage } from './ErrorMessage';

// Коды ошибок, которые будем использовать из компонентов
type ErrorCode =
  | 'albumsLoadFailed'
  | 'albumLoadFailed'
  | 'albumNotFound'
  | 'articlesLoadFailed'
  | 'articleLoadFailed'
  | 'uiLoadFailed'
  | 'trackLoadFailed'
  | 'generic';

const FALLBACK: Record<string, Record<ErrorCode, string>> = {
  ru: {
    albumsLoadFailed: 'Не удалось загрузить альбомы',
    albumLoadFailed: 'Не удалось загрузить альбом',
    albumNotFound: 'Альбом не найден',
    articlesLoadFailed: 'Не удалось загрузить статьи',
    articleLoadFailed: 'Не удалось загрузить статью',
    uiLoadFailed: 'Не удалось загрузить интерфейс',
    trackLoadFailed: 'Не удалось загрузить трек',
    generic: 'Ошибка загрузки',
  },
  en: {
    albumsLoadFailed: 'Failed to load albums',
    albumLoadFailed: 'Failed to load album',
    albumNotFound: 'Album not found',
    articlesLoadFailed: 'Failed to load articles',
    articleLoadFailed: 'Failed to load article',
    uiLoadFailed: 'Failed to load UI',
    trackLoadFailed: 'Failed to load track',
    generic: 'Load error',
  },
};

export default function ErrorI18n({ code, fallback }: { code: ErrorCode; fallback?: string }) {
  const dispatch = useAppDispatch();
  const { lang } = useLang();
  const status = useAppSelector((state) => selectUiDictionaryStatus(state, lang));
  const ui = useAppSelector((state) => selectUiDictionaryFirst(state, lang));
  const def = fallback ?? FALLBACK[lang as 'ru' | 'en']?.[code] ?? FALLBACK.en.generic;

  useEffect(() => {
    if (status === 'idle' || status === 'failed') {
      const promise = dispatch(fetchUiDictionary({ lang }));
      return () => {
        promise.abort();
      };
    }
  }, [dispatch, lang, status]);

  // Поддержка словаря вида: { errors: { albumsLoadFailed: "..." } }
  // @ts-ignore — если у тебя в типах нет поля errors, просто читаем опционально
  const localized = (ui?.errors as Record<ErrorCode, string> | undefined)?.[code] ?? def;

  return <ErrorMessage error={localized} />;
}
