import { useCallback, useRef, useEffect } from 'react';
import { useAppDispatch } from '@shared/lib/hooks/useAppDispatch';
import { playerActions } from '@features/player';
import { trackDebug } from '../utils/debug';

interface UsePlayerControlsParams {
  isCoarsePointerDevice: boolean;
  showLyrics: boolean;
  isPlaying: boolean;
  globalShowLyrics: boolean;
  setControlsVisible: (visible: boolean) => void;
  controlsVisibleRef: React.MutableRefObject<boolean>;
  inactivityTimerRef: React.MutableRefObject<ReturnType<typeof setTimeout> | null>;
  suppressScrollHandlingUntilRef: React.MutableRefObject<number>;
  controlsVisibilityCooldownUntilRef: React.MutableRefObject<number>;
  lastResetTimestampRef: React.MutableRefObject<number>;
  INACTIVITY_TIMEOUT: number;
}

/**
 * Хук для управления видимостью контролов плеера и таймером бездействия
 */
export function usePlayerControls({
  isCoarsePointerDevice,
  showLyrics,
  isPlaying,
  globalShowLyrics,
  setControlsVisible,
  controlsVisibleRef,
  inactivityTimerRef,
  suppressScrollHandlingUntilRef,
  controlsVisibilityCooldownUntilRef,
  lastResetTimestampRef,
  INACTIVITY_TIMEOUT,
}: UsePlayerControlsParams) {
  const dispatch = useAppDispatch();

  /**
   * Планирует скрытие контролов через таймаут бездействия
   */
  const scheduleControlsHide = useCallback(() => {
    if (isCoarsePointerDevice) {
      setControlsVisible(true);
      controlsVisibleRef.current = true;
      trackDebug('scheduleControlsHide:coarse');
      return;
    }

    // Очищаем предыдущий таймер перед созданием нового
    if (inactivityTimerRef.current) {
      clearTimeout(inactivityTimerRef.current);
      inactivityTimerRef.current = null;
    }

    if (showLyrics && isPlaying) {
      inactivityTimerRef.current = setTimeout(() => {
        // Проверяем, что состояние не изменилось за время ожидания
        if (showLyrics && isPlaying && controlsVisibleRef.current) {
          suppressScrollHandlingUntilRef.current = Date.now() + 400;
          controlsVisibleRef.current = false;
          setControlsVisible(false);
          trackDebug('controls-hidden:timer', { showLyrics, isPlaying });
        }
        inactivityTimerRef.current = null;
      }, INACTIVITY_TIMEOUT);
      trackDebug('scheduleControlsHide:set', {
        showLyrics,
        isPlaying,
        timeout: INACTIVITY_TIMEOUT,
      });
    } else {
      trackDebug('scheduleControlsHide:skip', { showLyrics, isPlaying });
    }
  }, [
    showLyrics,
    isPlaying,
    isCoarsePointerDevice,
    setControlsVisible,
    controlsVisibleRef,
    inactivityTimerRef,
    suppressScrollHandlingUntilRef,
    INACTIVITY_TIMEOUT,
  ]);

  /**
   * Показывает контролы и сбрасывает таймер бездействия
   */
  const showControls = useCallback(() => {
    // Очищаем таймер скрытия при показе контроллеров
    if (inactivityTimerRef.current) {
      clearTimeout(inactivityTimerRef.current);
      inactivityTimerRef.current = null;
      trackDebug('showControls:clear-timer');
    }

    const now = Date.now();
    suppressScrollHandlingUntilRef.current = now + 400;
    controlsVisibleRef.current = true;
    setControlsVisible(true);
    controlsVisibilityCooldownUntilRef.current = now + (isCoarsePointerDevice ? 900 : 400);
    trackDebug('showControls', { now, cooldown: controlsVisibilityCooldownUntilRef.current });
    scheduleControlsHide();
  }, [
    scheduleControlsHide,
    isCoarsePointerDevice,
    setControlsVisible,
    controlsVisibleRef,
    suppressScrollHandlingUntilRef,
    controlsVisibilityCooldownUntilRef,
  ]);

  useEffect(() => {
    controlsVisibleRef.current = true;
    setControlsVisible(true);
    showControls();
  }, [globalShowLyrics, showControls, setControlsVisible, controlsVisibleRef]);

  /**
   * Сбрасывает таймер бездействия (показывает контролы и планирует их скрытие)
   */
  const resetInactivityTimer = useCallback(() => {
    const now = Date.now();
    if (now - lastResetTimestampRef.current < 200) {
      trackDebug('resetInactivityTimer:throttled', { delta: now - lastResetTimestampRef.current });
      return;
    }
    lastResetTimestampRef.current = now;
    trackDebug('resetInactivityTimer');
    showControls();
  }, [showControls, lastResetTimestampRef]);

  // Управление таймером бездействия при изменении режима текста
  useEffect(() => {
    if (!showLyrics || !isPlaying) {
      // Если вышли из режима текста ИЛИ трек остановлен — скрываем контролы и очищаем таймер
      if (inactivityTimerRef.current) {
        clearTimeout(inactivityTimerRef.current);
        inactivityTimerRef.current = null;
      }
    } else if (showLyrics && isPlaying) {
      // Если вошли в режим текста И трек играет — запускаем таймер
      resetInactivityTimer();
    }
  }, [showLyrics, isPlaying, resetInactivityTimer, inactivityTimerRef]);

  return {
    showControls,
    scheduleControlsHide,
    resetInactivityTimer,
  };
}
