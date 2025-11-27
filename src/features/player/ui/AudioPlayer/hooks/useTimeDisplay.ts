import { useCallback, useEffect } from 'react';
import { audioController } from '@features/player/model/lib/audioController';
import { formatTimerValue } from '../utils/formatTime';
import type { PlayerTimeState } from '@features/player/model/types/playerSchema';

interface UseTimeDisplayParams {
  time: PlayerTimeState;
  timeDisplayRef: React.RefObject<HTMLDivElement>;
  formatTime: (time: number) => string;
}

/**
 * Хук для управления отображением времени трека
 */
export function useTimeDisplay({ time, timeDisplayRef, formatTime }: UseTimeDisplayParams) {
  /**
   * Рендерит отображение времени в DOM элемент
   */
  const renderTimeDisplay = useCallback(
    (currentSeconds: number, durationSeconds: number) => {
      const container = timeDisplayRef.current;
      if (!container) {
        return;
      }

      const normalizedCurrent = Number.isFinite(currentSeconds)
        ? Math.max(0, Math.floor(currentSeconds))
        : 0;
      const hasDuration = Number.isFinite(durationSeconds) && durationSeconds > 0;
      const normalizedDuration = hasDuration ? Math.max(0, Math.floor(durationSeconds)) : 0;
      const elapsed = hasDuration
        ? Math.min(normalizedCurrent, normalizedDuration)
        : normalizedCurrent;
      const remaining = hasDuration ? Math.max(normalizedDuration - elapsed, 0) : NaN;

      const fragment = document.createDocumentFragment();

      const currentSpan = document.createElement('span');
      currentSpan.className = 'player__time-current';
      currentSpan.textContent = formatTime(elapsed);

      const remainingSpan = document.createElement('span');
      remainingSpan.className = 'player__time-remaining';
      remainingSpan.textContent = hasDuration ? `-${formatTime(remaining)}` : formatTime(remaining);

      fragment.appendChild(currentSpan);
      fragment.appendChild(remainingSpan);
      container.replaceChildren(fragment);
    },
    [timeDisplayRef, formatTime]
  );

  // Подписываемся на события audio элемента для обновления времени
  useEffect(() => {
    const element = timeDisplayRef.current;
    if (!element) return;

    const audioElement = audioController.element;

    // Throttling для оптимизации
    let lastUpdate = 0;
    const UPDATE_INTERVAL = 100; // 100мс = 10 обновлений в секунду

    const updateDisplay = () => {
      const now = Date.now();
      if (now - lastUpdate < UPDATE_INTERVAL) return;
      lastUpdate = now;

      renderTimeDisplay(audioElement.currentTime, audioElement.duration);
    };

    // Подписываемся на событие timeupdate напрямую
    audioElement.addEventListener('timeupdate', updateDisplay);
    // Также обновляем при загрузке метаданных
    audioElement.addEventListener('loadedmetadata', updateDisplay);
    // И при изменении длительности
    audioElement.addEventListener('durationchange', updateDisplay);

    // Первоначальное обновление
    updateDisplay();

    return () => {
      audioElement.removeEventListener('timeupdate', updateDisplay);
      audioElement.removeEventListener('loadedmetadata', updateDisplay);
      audioElement.removeEventListener('durationchange', updateDisplay);
    };
  }, [renderTimeDisplay, timeDisplayRef]);

  // Обновляем отображение при изменении time из Redux
  useEffect(() => {
    renderTimeDisplay(time.current, time.duration);
  }, [time, renderTimeDisplay]);

  return {
    renderTimeDisplay,
  };
}
