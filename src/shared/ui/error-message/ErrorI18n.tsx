// src/shared/ui/error-message/ErrorI18n.tsx
import { useLang } from '@app/providers/lang';
import { useAppSelector } from '@shared/lib/hooks/useAppSelector';
import { selectUiDictionaryFirst } from '@shared/model/uiDictionary';
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
  const { lang } = useLang();
  const ui = useAppSelector((state) => selectUiDictionaryFirst(state, lang));
  const def = fallback ?? FALLBACK[lang as 'ru' | 'en']?.[code] ?? FALLBACK.en.generic;

  // UI словарь загружается через loader

  // Поддержка словаря вида: { errors: { albumsLoadFailed: "..." } }
  const localized = (ui?.errors as Record<ErrorCode, string> | undefined)?.[code] ?? def;

  return <ErrorMessage error={localized} />;
}
