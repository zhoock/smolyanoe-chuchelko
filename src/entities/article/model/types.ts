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
   * Какой контекст у текущего in-flight `fetchArticles` (см. pending в articlesSlice;
   * фон под модалкой дашборда не должен мигать скелетоном).
   */
  inFlightFetchContextKey: 'dashboard' | 'public' | null;
}
