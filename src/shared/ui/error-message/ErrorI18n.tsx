// src/shared/ui/error-message/ErrorI18n.tsx
import { DataAwait } from '@shared/DataAwait';
import { useAlbumsData } from '@hooks/data';
import { useLang } from '@contexts/lang';
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
  const data = useAlbumsData(lang);
  const def = fallback ?? FALLBACK[lang as 'ru' | 'en']?.[code] ?? FALLBACK.en.generic;

  // Если лоадер не прикручен/ещё не дал данные — показываем дефолт
  if (!data) return <ErrorMessage error={def} />;

  // Берём текст из словаря, если он там есть: templateC[0]?.errors?.<code>
  return (
    <DataAwait value={data.templateC} fallback={<ErrorMessage error={def} />} error={null}>
      {(ui) => {
        // Поддержка словаря вида: { errors: { albumsLoadFailed: "..." } }
        const dict = ui?.[0];
        const localized =
          // @ts-ignore — если у тебя в типах нет поля errors, просто читаем опционально
          dict?.errors?.[code] ?? def;

        return <ErrorMessage error={localized} />;
      }}
    </DataAwait>
  );
}
