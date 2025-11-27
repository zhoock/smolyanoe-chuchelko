import { useRef, useCallback, useEffect } from 'react';
import { useAppDispatch } from '@shared/lib/hooks/useAppDispatch';
import { playerActions } from '@features/player';
import type { PlayerTimeState } from '@features/player/model/types/playerSchema';

interface UseRewindParams {
  isPlaying: boolean;
  time: PlayerTimeState;
  progressInputRef: React.RefObject<HTMLInputElement>;
  isSeekingRef: React.MutableRefObject<boolean>;
  seekProtectionUntilRef: React.MutableRefObject<number>;
  showControls: () => void;
}

/**
 * Хук для обработки перемотки трека при удержании кнопок backward/forward
 */
export function useRewind({
  isPlaying,
  time,
  progressInputRef,
  isSeekingRef,
  seekProtectionUntilRef,
  showControls,
}: UseRewindParams) {
  const dispatch = useAppDispatch();

  // Refs для перемотки при удержании кнопок
  const rewindIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pressStartTimeRef = useRef<number | null>(null);
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isLongPressRef = useRef(false);
  const wasRewindingRef = useRef(false);
  const hasLongPressTimerRef = useRef(false);
  const shouldBlockTrackSwitchRef = useRef(false);
  const timeRef = useRef(time);

  // Обновляем ref при изменении time
  useEffect(() => {
    timeRef.current = time;
  }, [time]);

  /**
   * Обработчик начала нажатия на кнопку перемотки (backward/forward).
   * Различает короткое нажатие (переключение трека) и долгое удержание (перемотка внутри трека).
   */
  const handleRewindStart = useCallback(
    (direction: 'backward' | 'forward') => {
      showControls();

      const startTime = Date.now();
      pressStartTimeRef.current = startTime;
      isLongPressRef.current = false;
      wasRewindingRef.current = false;
      hasLongPressTimerRef.current = false;
      shouldBlockTrackSwitchRef.current = false;

      // Очищаем предыдущий таймер, если он есть
      if (longPressTimerRef.current) {
        clearTimeout(longPressTimerRef.current);
      }

      // Помечаем, что таймер запущен (даже до его срабатывания)
      hasLongPressTimerRef.current = true;

      // Через 200мс начинаем перемотку, если кнопка всё ещё удерживается
      longPressTimerRef.current = setTimeout(() => {
        if (pressStartTimeRef.current === startTime) {
          // Это долгое нажатие - начинаем перемотку
          isLongPressRef.current = true;
          wasRewindingRef.current = true;
          shouldBlockTrackSwitchRef.current = true;
          isSeekingRef.current = true;
          seekProtectionUntilRef.current = Date.now() + 2000;
          showControls();
          const step = direction === 'backward' ? -5 : 5; // перемотка на 5 секунд

          rewindIntervalRef.current = setInterval(() => {
            // Используем актуальные значения из ref
            const currentTime = timeRef.current.current || 0;
            const duration = timeRef.current.duration || 0;
            let newTime = currentTime + step;

            // Ограничиваем в пределах 0 - duration
            newTime = Math.max(0, Math.min(duration, newTime));

            const progress = (newTime / duration) * 100;

            dispatch(playerActions.setSeeking(true));
            seekProtectionUntilRef.current = Date.now() + 2000;
            dispatch(playerActions.setCurrentTime(newTime));
            dispatch(playerActions.setTime({ current: newTime, duration }));
            dispatch(playerActions.setProgress(progress));

            // Обновляем CSS переменную для синхронизации со слайдером
            if (progressInputRef.current) {
              progressInputRef.current.style.setProperty('--progress-width', `${progress}%`);
            }
          }, 200); // каждые 200мс
        }
      }, 200); // задержка перед началом перемотки
    },
    [dispatch, showControls, isSeekingRef, seekProtectionUntilRef, progressInputRef]
  );

  /**
   * Обработчик окончания нажатия на кнопку перемотки.
   * Если это было короткое нажатие - переключаем трек, если долгое - останавливаем перемотку.
   */
  const handleRewindEnd = useCallback(
    (direction: 'backward' | 'forward', originalHandler: () => void) => {
      const pressDuration = pressStartTimeRef.current ? Date.now() - pressStartTimeRef.current : 0;

      // КРИТИЧЕСКИ ВАЖНО: Сохраняем значение флага блокировки СРАЗУ, ДО всех операций
      const isRewindingActive = shouldBlockTrackSwitchRef.current;

      // Останавливаем таймер долгого нажатия
      if (longPressTimerRef.current) {
        clearTimeout(longPressTimerRef.current);
        longPressTimerRef.current = null;
      }

      // Останавливаем перемотку
      if (rewindIntervalRef.current) {
        clearInterval(rewindIntervalRef.current);
        rewindIntervalRef.current = null;
        dispatch(playerActions.setSeeking(false));
        isSeekingRef.current = false;
        seekProtectionUntilRef.current = Date.now() + 1500;
        showControls();
        // Если трек играл, продолжаем воспроизведение
        if (isPlaying) {
          dispatch(playerActions.play());
        }
      }

      // ПРОСТАЯ ЛОГИКА: Если перемотка работала - НЕ переключаем трек
      if (isRewindingActive) {
        // Перемотка работала - трек НЕ переключаем
        setTimeout(() => {
          pressStartTimeRef.current = null;
          isLongPressRef.current = false;
          hasLongPressTimerRef.current = false;
          wasRewindingRef.current = false;
          setTimeout(() => {
            shouldBlockTrackSwitchRef.current = false;
          }, 300);
        }, 150);
        return;
      }

      // Если перемотка НЕ работала - проверяем, был ли это короткий клик
      if (pressDuration > 0 && pressDuration < 150) {
        // Очень короткое нажатие - переключаем трек
        originalHandler();
      } else if (pressDuration >= 180) {
        // Нажатие было достаточно долгим - таймер мог сработать, не переключаем трек
      }

      // Сбрасываем флаги с задержкой, чтобы onClick успел проверить
      setTimeout(() => {
        pressStartTimeRef.current = null;
        isLongPressRef.current = false;
        hasLongPressTimerRef.current = false;
        wasRewindingRef.current = false;
      }, 150);
    },
    [dispatch, isPlaying, showControls, isSeekingRef, seekProtectionUntilRef]
  );

  /**
   * Обработчик клика на кнопку перемотки (для обычного клика без долгого удержания).
   */
  const handleRewindClick = useCallback(
    (direction: 'backward' | 'forward', originalHandler: () => void) => {
      // ПРОСТАЯ ЛОГИКА: Если перемотка работает - НЕ переключаем трек
      if (shouldBlockTrackSwitchRef.current) {
        return;
      }
      // Если перемотка НЕ работает - переключаем трек
      originalHandler();
    },
    []
  );

  // Очистка при размонтировании
  useEffect(() => {
    return () => {
      if (rewindIntervalRef.current) {
        clearInterval(rewindIntervalRef.current);
        rewindIntervalRef.current = null;
      }
      if (longPressTimerRef.current) {
        clearTimeout(longPressTimerRef.current);
        longPressTimerRef.current = null;
      }
      hasLongPressTimerRef.current = false;
      isLongPressRef.current = false;
      wasRewindingRef.current = false;
      pressStartTimeRef.current = null;
    };
  }, []);

  // Функция для проверки, активна ли перемотка (используется в onClick обработчиках)
  const isRewindingActive = useCallback(() => {
    return shouldBlockTrackSwitchRef.current;
  }, []);

  return {
    handleRewindStart,
    handleRewindEnd,
    handleRewindClick,
    isRewindingActive,
  };
}
