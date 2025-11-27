import { useCallback } from 'react';
import { useAppDispatch } from '@shared/lib/hooks/useAppDispatch';
import { playerActions } from '@features/player';
import { audioController } from '@features/player/model/lib/audioController';
import type { PlayerTimeState } from '@features/player/model/types/playerSchema';
import { debugLog } from '../utils/debug';

interface UseSeekParams {
  isPlaying: boolean;
  time: PlayerTimeState;
  progressInputRef: React.RefObject<HTMLInputElement>;
  isSeekingRef: React.MutableRefObject<boolean>;
  seekProtectionUntilRef: React.MutableRefObject<number>;
  suppressActiveLineRef: React.MutableRefObject<boolean>;
  userScrollTimestampRef: React.MutableRefObject<number>;
  isUserScrollingRef: React.MutableRefObject<boolean>;
  setLyricsOpacityMode: React.Dispatch<
    React.SetStateAction<'normal' | 'user-scrolling' | 'seeking'>
  >;
  resetInactivityTimer: () => void;
}

/**
 * Хук для обработки перемотки трека (seek)
 */
export function useSeek({
  isPlaying,
  time,
  progressInputRef,
  isSeekingRef,
  seekProtectionUntilRef,
  suppressActiveLineRef,
  userScrollTimestampRef,
  isUserScrollingRef,
  setLyricsOpacityMode,
  resetInactivityTimer,
}: UseSeekParams) {
  const dispatch = useAppDispatch();

  /**
   * Обработчик клика на строку текста для перемотки трека
   */
  const handleLineClick = useCallback(
    (startTime: number) => {
      if (!time.duration || time.duration <= 0) return;

      suppressActiveLineRef.current = false;

      const newTime = Math.max(0, Math.min(time.duration, startTime));
      const progress = (newTime / time.duration) * 100;
      const shouldResumePlayback = !isPlaying;

      dispatch(playerActions.setSeeking(true));
      isSeekingRef.current = true;
      seekProtectionUntilRef.current = Date.now() + 2000;
      dispatch(playerActions.setCurrentTime(newTime));
      dispatch(playerActions.setTime({ current: newTime, duration: time.duration }));
      dispatch(playerActions.setProgress(progress));

      // Обновляем CSS переменную для синхронизации со слайдером
      if (progressInputRef.current) {
        progressInputRef.current.style.setProperty('--progress-width', `${progress}%`);
      }

      // Снимаем флаг isSeeking после перемотки
      // Если трек играл, продолжаем воспроизведение
      setTimeout(() => {
        dispatch(playerActions.setSeeking(false));
        isSeekingRef.current = false;
        seekProtectionUntilRef.current = Date.now() + 1500;
        if (isPlaying || shouldResumePlayback) {
          dispatch(playerActions.play());
        }
      }, 100);
    },
    [
      dispatch,
      time.duration,
      isPlaying,
      progressInputRef,
      isSeekingRef,
      seekProtectionUntilRef,
      suppressActiveLineRef,
    ]
  );

  /**
   * Обработчик изменения позиции слайдера прогресса (перемотка трека)
   */
  const handleProgressChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const duration = time.duration;
      if (!Number.isFinite(duration) || duration <= 0) return;

      suppressActiveLineRef.current = false;

      const value = Number(event.target.value);
      const newTime = (value / 100) * duration;

      dispatch(playerActions.setSeeking(true));
      // ЯВНО устанавливаем время в audio элементе сразу, не дожидаясь middleware
      audioController.setCurrentTime(newTime);
      dispatch(playerActions.setCurrentTime(newTime));
      dispatch(playerActions.setTime({ current: newTime, duration }));
      dispatch(playerActions.setProgress(value));
      event.target.style.setProperty('--progress-width', `${value}%`);

      // Сбрасываем флаг ручной прокрутки при клике на прогрессбар
      userScrollTimestampRef.current = 0;
      isUserScrollingRef.current = false;
      // Устанавливаем режим прозрачности для перетаскивания прогресс-бара
      setLyricsOpacityMode((prevMode) => {
        debugLog('🔍 Seeking started, prev mode:', prevMode, '-> seeking');
        return 'seeking';
      });
      // Сбрасываем таймер бездействия при взаимодействии с прогресс-баром
      resetInactivityTimer();
      isSeekingRef.current = true;
      seekProtectionUntilRef.current = Date.now() + 2000;
    },
    [
      dispatch,
      time.duration,
      resetInactivityTimer,
      suppressActiveLineRef,
      userScrollTimestampRef,
      isUserScrollingRef,
      setLyricsOpacityMode,
      isSeekingRef,
      seekProtectionUntilRef,
    ]
  );

  /**
   * Обработчик окончания перемотки (когда пользователь отпустил слайдер)
   */
  const handleSeekEnd = useCallback(() => {
    // Сразу снимаем флаг isSeeking (разрешает автообновление прогресса)
    dispatch(playerActions.setSeeking(false));
    isSeekingRef.current = false;
    if (isPlaying) {
      dispatch(playerActions.play());
    }
    seekProtectionUntilRef.current = Date.now() + 1500;
    // Возвращаем режим прозрачности к нормальному сразу после окончания перетаскивания
    // Только если пользователь не прокручивает вручную
    const timeSinceUserScroll = Date.now() - userScrollTimestampRef.current;
    if (timeSinceUserScroll >= 2000) {
      setLyricsOpacityMode((prevMode) => {
        // Не сбрасываем, если пользователь активно прокручивает
        if (prevMode === 'user-scrolling') {
          debugLog('⚠️ handleSeekEnd: keeping user-scrolling mode');
          return prevMode;
        }
        debugLog('🔍 handleSeekEnd: resetting to normal');
        return 'normal';
      });
    }
  }, [
    dispatch,
    isPlaying,
    isSeekingRef,
    seekProtectionUntilRef,
    userScrollTimestampRef,
    setLyricsOpacityMode,
  ]);

  return {
    handleLineClick,
    handleProgressChange,
    handleSeekEnd,
  };
}
