/**
 * Селекторы для получения данных из Redux стейта альбомов.
 * Используем createSelector для мемоизации - это предотвращает лишние пересчёты и ре-рендеры.
 */
import { createSelector } from '@reduxjs/toolkit';
import type { RootState } from '@shared/model/appStore/types';
import type { IAlbums } from '@models';

import { selectCurrentLang } from '@shared/model/lang/selectors';
import { resolveAlbumForDisplay } from '../lib/resolveAlbumDisplay';
import type { AlbumsState } from './types';

export const selectAlbumsState = (state: RootState): AlbumsState => state.albums;

export const selectAlbumsStatus = createSelector([selectAlbumsState], (s) => s.status);

export const selectAlbumsError = createSelector([selectAlbumsState], (s) => s.error);

export const selectAlbumsData = createSelector([selectAlbumsState], (s): IAlbums[] => s.data);

export const selectAlbumsFetchContextKey = createSelector(
  [selectAlbumsState],
  (s) => s.fetchContextKey
);

export const selectAlbumsInFlightFetchContextKey = createSelector(
  [selectAlbumsState],
  (s) => s.inFlightFetchContextKey
);

export const selectAlbumById = createSelector(
  [selectAlbumsData, (_state: RootState, albumId: string) => albumId],
  (albums, albumId) => albums.find((album) => album.albumId === albumId)
);

/** Для отображения: строки с fallback по `state.lang.current`. */
export const selectAlbumsDataResolved = createSelector(
  [selectAlbumsData, selectCurrentLang],
  (albums, lang): IAlbums[] => albums.map((a) => resolveAlbumForDisplay(a, lang))
);

/** Публичный каталог: только альбомы с `isPublic !== false` (undefined — как раньше, видимы). */
export const selectPublicAlbumsDataResolved = createSelector(
  [selectAlbumsDataResolved],
  (albums): IAlbums[] => albums.filter((a) => a.isPublic !== false)
);

/**
 * Список на /albums: при `restrictToPublished === true` — как публичный каталог;
 * при `false` (есть `?artist=`) — полный список владельца.
 */
export const selectAlbumsResolvedForAllAlbumsPage = createSelector(
  [
    selectAlbumsDataResolved,
    (_state: RootState, restrictToPublished: boolean) => restrictToPublished,
  ],
  (albums, restrictToPublished): IAlbums[] =>
    restrictToPublished ? albums.filter((a) => a.isPublic !== false) : albums
);

export const selectAlbumByIdResolved = createSelector(
  [selectAlbumsDataResolved, (_state: RootState, albumId: string) => albumId],
  (albums, albumId) => albums.find((album) => album.albumId === albumId)
);
