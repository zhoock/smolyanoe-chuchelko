// src/features/player/model/middleware/playerListeners.ts
/**
 * Middleware для обработки побочных эффектов плеера.
 * Здесь мы "слушаем" действия Redux и выполняем соответствующие операции с аудио-элементом.
 * Это позволяет вынести всю логику управления аудио из компонентов в слой модели.
 */
import { createListenerMiddleware, isAnyOf, type ListenerEffectAPI } from '@reduxjs/toolkit';
import { audioController } from '../lib/audioController';
import { playerActions } from '../slice/playerSlice';
import type { RootState, AppDispatch } from '@app/providers/StoreProvider/config/store';

// Создаём middleware для слушателей
export const playerListenerMiddleware = createListenerMiddleware<RootState, AppDispatch>();

/**
 * Вспомогательная функция: устанавливает громкость и запускает воспроизведение.
 * Игнорирует ошибки autoplay (когда браузер блокирует автозапуск).
 */
const tryPlayWithVolume = async (volume: number): Promise<void> => {
  audioController.setVolume(volume);
  try {
    await audioController.play();
  } catch {
    // ignore autoplay errors
  }
};

/**
 * Вспомогательная функция: сбрасывает прогресс и время трека в стейте.
 * Используется при смене трека или плейлиста.
 */
const resetProgress = (api: ListenerEffectAPI<RootState, AppDispatch>) => {
  api.dispatch(playerActions.setProgress(0));
  api.dispatch(playerActions.setTime({ current: 0, duration: NaN }));
};

/**
 * Слушатель для действия play (воспроизведение).
 * Когда диспатчится playerActions.play(), этот код запускает воспроизведение аудио.
 */
playerListenerMiddleware.startListening({
  actionCreator: playerActions.play,
  effect: async (_, api) => {
    const state = api.getState();
    await tryPlayWithVolume(state.player.volume);
  },
});

/**
 * Слушатель для действия pause (пауза).
 * Когда диспатчится playerActions.pause(), останавливает воспроизведение.
 */
playerListenerMiddleware.startListening({
  actionCreator: playerActions.pause,
  effect: () => {
    audioController.pause();
  },
});

/**
 * Слушатель для действия toggle (переключение play/pause).
 * Проверяет текущее состояние и либо запускает, либо останавливает воспроизведение.
 */
playerListenerMiddleware.startListening({
  actionCreator: playerActions.toggle,
  effect: async (_, api) => {
    const state = api.getState();
    if (state.player.isPlaying) {
      await tryPlayWithVolume(state.player.volume);
    } else {
      audioController.pause();
    }
  },
});

/**
 * Слушатель для изменения громкости.
 * При вызове playerActions.setVolume() обновляет громкость аудио-элемента.
 */
playerListenerMiddleware.startListening({
  actionCreator: playerActions.setVolume,
  effect: ({ payload }) => {
    audioController.setVolume(payload);
  },
});

/**
 * Слушатель для перемотки (seek).
 * При вызове playerActions.setCurrentTime() перематывает трек на указанное время.
 */
playerListenerMiddleware.startListening({
  actionCreator: playerActions.setCurrentTime,
  effect: ({ payload }) => {
    audioController.setCurrentTime(payload);
  },
});

/**
 * Слушатель для смены текущего трека (по индексу).
 * Загружает новый трек в аудио-элемент, но НЕ запускает его автоматически.
 * Используется когда пользователь просто выбирает трек (например, кликает в списке).
 */
playerListenerMiddleware.startListening({
  actionCreator: playerActions.setCurrentTrackIndex,
  effect: (_, api) => {
    const state = api.getState();
    const track = state.player.playlist?.[state.player.currentTrackIndex];
    resetProgress(api);
    audioController.setSource(track?.src);
  },
});

/**
 * Слушатель для переключения на следующий/предыдущий трек.
 * Использует matcher чтобы обработать оба действия (nextTrack и prevTrack) одним кодом.
 * ВАЖНО: если трек играл, то после переключения он продолжит играть.
 * Если трек был на паузе, то новый трек тоже будет на паузе.
 */
playerListenerMiddleware.startListening({
  matcher: isAnyOf(playerActions.nextTrack, playerActions.prevTrack),
  effect: async (_, api) => {
    const state = api.getState();
    const { playlist = [], currentTrackIndex, isPlaying: wasPlaying, volume } = state.player;
    const trackSrc = playlist[currentTrackIndex]?.src;

    if (!trackSrc) return;

    resetProgress(api);
    audioController.pause();
    audioController.setSource(trackSrc);

    if (wasPlaying) {
      await tryPlayWithVolume(volume);
    }
  },
});

/**
 * Слушатель для запроса воспроизведения.
 * requestPlay() используется когда нужно запустить трек (например, при открытии плеера).
 * Это действие просто инкрементирует playRequestId, а этот слушатель вызывает play().
 */
playerListenerMiddleware.startListening({
  actionCreator: playerActions.requestPlay,
  effect: (_, api) => {
    api.dispatch(playerActions.play());
  },
});

/**
 * Привязывает события HTMLAudioElement к обновлениям Redux стейта.
 * Эта функция вызывается один раз при создании store.
 *
 * События браузера → Redux actions:
 * - timeupdate → обновление времени и прогресса
 * - loadedmetadata → сброс времени при загрузке нового трека
 * - ended → автоматический переход на следующий трек
 */
export const attachAudioEvents = (dispatch: AppDispatch, getState: () => RootState): void => {
  const el = audioController.element;

  // Устанавливаем начальную громкость из стейта
  audioController.setVolume(getState().player.volume);

  /**
   * Событие timeupdate срабатывает постоянно во время воспроизведения.
   * Обновляет текущее время и прогресс в стейте.
   * НО: не обновляет, если пользователь перематывает трек вручную (isSeeking = true).
   */
  el.addEventListener('timeupdate', () => {
    const state = getState();
    if (state.player.isSeeking) return;

    const { duration, currentTime } = el;
    if (!Number.isFinite(duration) || duration <= 0) return;

    const progress = (currentTime / duration) * 100;
    dispatch(playerActions.setTime({ current: currentTime, duration }));
    dispatch(playerActions.setProgress(progress));
  });

  /**
   * Событие loadedmetadata срабатывает когда загружены метаданные трека (длительность и т.д.).
   * Сбрасываем время и прогресс, чтобы UI показал начало трека.
   */
  el.addEventListener('loadedmetadata', () => {
    dispatch(playerActions.setTime({ current: 0, duration: el.duration }));
    dispatch(playerActions.setProgress(0));
  });

  /**
   * Событие ended срабатывает когда трек доиграл до конца.
   * Автоматически переключаем на следующий трек, если плейлист не пуст.
   */
  el.addEventListener('ended', () => {
    const { playlist = [] } = getState().player;
    if (playlist.length > 0) {
      dispatch(playerActions.nextTrack(playlist.length));
    }
  });
};
