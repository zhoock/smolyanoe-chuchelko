/**
 * Redux Toolkit Slice для управления состоянием аудиоплеера.
 * Здесь определяем все действия (actions) и как они изменяют стейт.
 */
import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { PlayerState, initialPlayerState, PlayerTimeState } from '../types/playerSchema';
import type { TracksProps } from '../../../../models';

const playerSlice = createSlice({
  name: 'player',
  initialState: initialPlayerState,
  reducers: {
    /**
     * Действие play - устанавливает флаг isPlaying в true.
     * Само воспроизведение запускается в middleware (playerListeners.ts).
     */
    play(state) {
      state.isPlaying = true;
    },
    /**
     * Действие pause - устанавливает флаг isPlaying в false.
     * Остановка воспроизведения происходит в middleware.
     */
    pause(state) {
      state.isPlaying = false;
    },
    /**
     * Действие toggle - переключает isPlaying между true и false.
     */
    toggle(state) {
      state.isPlaying = !state.isPlaying;
    },
    /**
     * Устанавливает громкость (0-100).
     */
    setVolume(state, action: PayloadAction<number>) {
      state.volume = Math.max(0, Math.min(100, action.payload));
    },
    /**
     * Устанавливает флаг isSeeking (пользователь перематывает трек).
     * Нужен чтобы временно отключить автоматическое обновление прогресса.
     */
    setSeeking(state, action: PayloadAction<boolean>) {
      state.isSeeking = action.payload;
    },
    /**
     * Устанавливает прогресс воспроизведения (0-100%).
     */
    setProgress(state, action: PayloadAction<number>) {
      state.progress = Math.max(0, Math.min(100, action.payload));
    },
    /**
     * Устанавливает текущее время и длительность трека.
     */
    setTime(state, action: PayloadAction<PlayerTimeState>) {
      state.time = action.payload;
    },
    /**
     * Устанавливает только текущее время (длительность не трогаем).
     */
    setCurrentTime(state, action: PayloadAction<number>) {
      state.time = { ...state.time, current: action.payload };
    },
    /**
     * Устанавливает новый плейлист (массив треков).
     * Если текущий индекс выходит за пределы нового плейлиста, сбрасываем его на 0.
     */
    setPlaylist(state, action: PayloadAction<TracksProps[]>) {
      state.playlist = action.payload ?? [];
      // сбрасывать индекс, если он вышел за пределы
      if (state.currentTrackIndex >= state.playlist.length) {
        state.currentTrackIndex = 0;
      }
    },
    /**
     * Устанавливает индекс текущего трека в плейлисте.
     * Используется когда пользователь выбирает конкретный трек.
     */
    setCurrentTrackIndex(state, action: PayloadAction<number>) {
      const idx = Math.max(0, action.payload);
      state.currentTrackIndex = idx;
    },
    /**
     * Переключает на следующий трек в плейлисте.
     * Использует модульную арифметику для циклического переключения.
     * @param action.payload - общее количество треков в плейлисте
     */
    nextTrack(state, action: PayloadAction<number>) {
      const total = Math.max(0, action.payload);
      if (total > 0) state.currentTrackIndex = (state.currentTrackIndex + 1) % total;
    },
    /**
     * Переключает на предыдущий трек в плейлисте.
     * Использует модульную арифметику для циклического переключения.
     * @param action.payload - общее количество треков в плейлисте
     */
    prevTrack(state, action: PayloadAction<number>) {
      const total = Math.max(0, action.payload);
      if (total > 0) state.currentTrackIndex = (state.currentTrackIndex - 1 + total) % total;
    },
    /**
     * Запрос на воспроизведение.
     * Просто инкрементирует playRequestId, что вызывает useEffect в компоненте,
     * который в свою очередь диспатчит play(). Используется для запуска трека при открытии плеера.
     */
    requestPlay(state) {
      state.playRequestId += 1;
    },
  },
});

export const { reducer: playerReducer, actions: playerActions } = playerSlice;
