/**
 * Селекторы для получения данных из Redux стейта плеера.
 * Используем createSelector для мемоизации - это предотвращает лишние пересчёты и ре-рендеры.
 */
import { createSelector } from '@reduxjs/toolkit';
import type { RootState } from '@app/providers/StoreProvider/config/store';

// Базовый селектор - получает весь стейт плеера
export const selectPlayer = (state: RootState) => state.player;

// Простые селекторы - возвращают конкретные поля из стейта
export const selectIsPlaying = createSelector([selectPlayer], (player) => player.isPlaying);
export const selectVolume = createSelector([selectPlayer], (player) => player.volume);
export const selectIsSeeking = createSelector([selectPlayer], (player) => player.isSeeking);
export const selectProgress = createSelector([selectPlayer], (player) => player.progress);
export const selectTime = createSelector([selectPlayer], (player) => player.time);
export const selectCurrentTrackIndex = createSelector(
  [selectPlayer],
  (player) => player.currentTrackIndex
);
export const selectPlaylist = createSelector([selectPlayer], (player) => player.playlist);
export const selectPlayRequestId = createSelector([selectPlayer], (player) => player.playRequestId);

/**
 * Производный селектор - вычисляет текущий трек на основе плейлиста и индекса.
 * Мемоизируется автоматически: пересчитывается только если изменятся playlist или currentTrackIndex.
 */
export const selectCurrentTrack = createSelector(
  [selectPlaylist, selectCurrentTrackIndex],
  (playlist, index) => playlist[index]
);
