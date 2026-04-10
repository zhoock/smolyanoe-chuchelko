import type { IAlbums } from '@models';

export type RequestStatus = 'idle' | 'loading' | 'succeeded' | 'failed';

/**
 * Один источник правды для списка альбомов.
 * Язык интерфейса — `state.lang.current`, не дублируем данные по en/ru.
 */
export interface AlbumsState {
  status: RequestStatus;
  error: string | null;
  data: IAlbums[];
  lastUpdated: number | null;
}
