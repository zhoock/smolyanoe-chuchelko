/**
 * Селекторы для получения данных из Redux стейта альбомов.
 * Используем createSelector для мемоизации - это предотвращает лишние пересчёты и ре-рендеры.
 */
import { createSelector } from '@reduxjs/toolkit';
import type { RootState } from '@shared/model/appStore/types';
import type { SupportedLang } from '@shared/model/lang';
import type { IAlbums } from '@models';

import type { AlbumsEntry } from './types';

// Базовый селектор - получает весь стейт альбомов
export const selectAlbumsState = (state: RootState): Record<SupportedLang, AlbumsEntry> =>
  state.albums;

// Мемоизированный селектор для получения записи по языку
export const selectAlbumsEntry = createSelector(
  [selectAlbumsState, (_state: RootState, lang: SupportedLang) => lang],
  (albums, lang): AlbumsEntry => albums[lang]
);

// Мемоизированный селектор для статуса загрузки
export const selectAlbumsStatus = createSelector(
  [selectAlbumsEntry, (_state: RootState, lang: SupportedLang) => lang],
  (entry) => entry.status
);

// Мемоизированный селектор для ошибки
export const selectAlbumsError = createSelector(
  [selectAlbumsEntry, (_state: RootState, lang: SupportedLang) => lang],
  (entry) => entry.error
);

// Мемоизированный селектор для данных
export const selectAlbumsData = createSelector(
  [selectAlbumsEntry, (_state: RootState, lang: SupportedLang) => lang],
  (entry): IAlbums[] => entry.data
);

// Мемоизированный селектор для поиска альбома по ID
export const selectAlbumById = createSelector(
  [selectAlbumsData, (_state: RootState, _lang: SupportedLang, albumId: string) => albumId],
  (albums, albumId) => albums.find((album) => album.albumId === albumId)
);
