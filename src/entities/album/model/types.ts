import type { IAlbums } from '@models';

export type RequestStatus = 'idle' | 'loading' | 'succeeded' | 'failed';

/**
 * Один источник правды для списка альбомов.
 * Язык интерфейса — `state.lang.current`, не дублируем данные по en/ru.
 */
/** Синхронизация кэша с маршрутом: public slug / дашборд / каталог без artist. */
export interface AlbumsState {
  status: RequestStatus;
  error: string | null;
  data: IAlbums[];
  lastUpdated: number | null;
  /** Какой контекст запроса соответствует `data` (см. albumsLoader + fetchAlbums). */
  fetchContextKey: string | null;
  /**
   * Какой контекст у текущего in-flight `fetchAlbums` (снимок `window` в pending),
   * чтобы фон (Home под модалкой) не мигал скелетоном, пока дашборд качает тот же слайс.
   */
  inFlightFetchContextKey: 'dashboard' | 'public' | null;
}

export interface FetchAlbumsFulfilledPayload {
  albums: IAlbums[];
  fetchContextKey: string;
  /** Ответ устарел: маршрут/контекст сменился до завершения запроса — не перезаписывать store. */
  staleAbort?: boolean;
}
