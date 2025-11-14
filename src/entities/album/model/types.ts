import type { IAlbums } from '@models';
import type { SupportedLang } from '@shared/model/lang';

export type RequestStatus = 'idle' | 'loading' | 'succeeded' | 'failed';

export interface AlbumsEntry {
  status: RequestStatus;
  error: string | null;
  data: IAlbums[];
  lastUpdated: number | null;
}

export type AlbumsState = Record<SupportedLang, AlbumsEntry>;
