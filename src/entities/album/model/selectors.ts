import type { RootState } from '@shared/model/appStore/types';
import type { SupportedLang } from '@shared/model/lang';
import type { IAlbums } from '@models';

import type { AlbumsEntry } from './types';

export const selectAlbumsState = (state: RootState): Record<SupportedLang, AlbumsEntry> =>
  state.albums;

export const selectAlbumsEntry = (state: RootState, lang: SupportedLang): AlbumsEntry =>
  selectAlbumsState(state)[lang];

export const selectAlbumsStatus = (state: RootState, lang: SupportedLang) =>
  selectAlbumsEntry(state, lang).status;

export const selectAlbumsError = (state: RootState, lang: SupportedLang) =>
  selectAlbumsEntry(state, lang).error;

export const selectAlbumsData = (state: RootState, lang: SupportedLang): IAlbums[] =>
  selectAlbumsEntry(state, lang).data;

export const selectAlbumById = (state: RootState, lang: SupportedLang, albumId: string) =>
  selectAlbumsData(state, lang).find((album) => album.albumId === albumId);
