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
}

export interface FetchAlbumsFulfilledPayload {
  albums: IAlbums[];
  fetchContextKey: string;
  /** Ответ устарел: маршрут/контекст сменился до завершения запроса — не перезаписывать store. */
  staleAbort?: boolean;
}
