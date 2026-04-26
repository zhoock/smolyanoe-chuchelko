import type { IArticles } from '@models';

export type RequestStatus = 'idle' | 'loading' | 'succeeded' | 'failed';

/**
 * Один источник правды для списка статей.
 * Язык интерфейса — `state.lang.current`, не дублируем данные по en/ru.
 */
export interface ArticlesState {
  status: RequestStatus;
  error: string | null;
  data: IArticles[];
  lastUpdated: number | null;
  /** Публичный контекст последней успешной загрузки: '' = дефолтный сайт, иначе public_slug */
  lastPublicArtistSlug?: string | null;
  /**
   * Какой контекст у текущего in-flight публичного списка (`data`);
   * загрузка кабинета идёт в `dashboard` и не трогает этот флаг как «dashboard».
   */
  inFlightFetchContextKey: 'dashboard' | 'public' | null;
  /** Статьи владельца для `/dashboard*` — отдельно от публичного каталога. */
  dashboard: {
    status: RequestStatus;
    error: string | null;
    data: IArticles[];
    lastUpdated: number | null;
    inFlightFetchContextKey: 'dashboard' | null;
  };
}
