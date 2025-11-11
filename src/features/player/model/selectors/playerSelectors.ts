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
// Селектор для времени трека - возвращает весь объект времени
// ВАЖНО: Не используем resultEqualityCheck, так как объект time всегда новый при каждом обновлении
// Вместо этого используем отдельные селекторы selectTimeCurrent и selectTimeDuration
export const selectTime = createSelector([selectPlayer], (player) => player.time);
// Отдельные селекторы для current и duration для более точного отслеживания изменений
export const selectTimeCurrent = createSelector([selectPlayer], (player) => player.time.current);
export const selectTimeDuration = createSelector([selectPlayer], (player) => player.time.duration);
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

// Селектор для режима перемешивания
export const selectShuffle = createSelector([selectPlayer], (player) => player.shuffle);

// Селектор для режима зацикливания
export const selectRepeat = createSelector([selectPlayer], (player) => player.repeat);
export const selectShowLyrics = createSelector([selectPlayer], (player) => player.showLyrics);
export const selectControlsVisible = createSelector(
  [selectPlayer],
  (player) => player.controlsVisible
);

// Селектор для минимальных данных альбома
export const selectAlbumMeta = createSelector([selectPlayer], (player) => player.albumMeta);

// Селектор для маршрута, где был открыт плеер
export const selectSourceLocation = createSelector(
  [selectPlayer],
  (player) => player.sourceLocation
);

// Утилита: есть ли что воспроизводить
export const selectHasPlaylist = createSelector(
  [selectPlaylist],
  (playlist) => playlist.length > 0
);
