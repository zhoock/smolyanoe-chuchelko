import { useEffect, RefObject } from 'react';
import { debugLog, trackDebug } from '../utils/debug';

interface UseLyricsManualScrollParams {
  showLyrics: boolean;
  lyricsContainerRef: RefObject<HTMLDivElement>;
  isCoarsePointerDevice: boolean;
  savedScrollTopRef: React.MutableRefObject<number>;
  justRestoredScrollRef: React.MutableRefObject<boolean>;
  userScrollTimestampRef: React.MutableRefObject<number>;
  lastScrollTopRef: React.MutableRefObject<number>;
  pendingScrollTopRef: React.MutableRefObject<number>;
  lastScrollDirectionRef: React.MutableRefObject<'up' | 'down' | null>;
  manualScrollRafRef: React.MutableRefObject<number | null>;
  userScrolledToEndRef: React.MutableRefObject<boolean>;
  isUserScrollingRef: React.MutableRefObject<boolean>;
  suppressScrollHandlingUntilRef: React.MutableRefObject<number>;
  controlsVisibilityCooldownUntilRef: React.MutableRefObject<number>;
  seekProtectionUntilRef: React.MutableRefObject<number>;
  isSeekingRef: React.MutableRefObject<boolean>;
  smoothScrollAnimationRef: React.MutableRefObject<number | null>;
  controlsVisibleRef: React.MutableRefObject<boolean>;
  inactivityTimerRef: React.MutableRefObject<ReturnType<typeof setTimeout> | null>;
  scrollListenerJustAddedRef: React.MutableRefObject<boolean>;
  setLyricsOpacityMode: React.Dispatch<
    React.SetStateAction<'normal' | 'user-scrolling' | 'seeking'>
  >;
  setControlsVisible: (visible: boolean) => void;
  showControls: () => void;
  resetInactivityTimer: () => void;
  scheduleControlsHide: () => void;
}

const IMMEDIATE_DIRECTION_THRESHOLD = 2;
const STICKY_END_THRESHOLD = 24;

/**
 * Хук для обработки ручной прокрутки текста пользователем
 */
export function useLyricsManualScroll({
  showLyrics,
  lyricsContainerRef,
  isCoarsePointerDevice,
  savedScrollTopRef,
  justRestoredScrollRef,
  userScrollTimestampRef,
  lastScrollTopRef,
  pendingScrollTopRef,
  lastScrollDirectionRef,
  manualScrollRafRef,
  userScrolledToEndRef,
  isUserScrollingRef,
  suppressScrollHandlingUntilRef,
  controlsVisibilityCooldownUntilRef,
  seekProtectionUntilRef,
  isSeekingRef,
  smoothScrollAnimationRef,
  controlsVisibleRef,
  inactivityTimerRef,
  scrollListenerJustAddedRef,
  setLyricsOpacityMode,
  setControlsVisible,
  showControls,
  resetInactivityTimer,
  scheduleControlsHide,
}: UseLyricsManualScrollParams) {
  useEffect(() => {
    // Ждем, пока контейнер будет готов (showLyrics может быть false при первом рендере)
    if (!showLyrics) {
      return;
    }

    const container = lyricsContainerRef.current;
    if (!container) {
      return;
    }

    // Инициализируем начальные значения
    if (savedScrollTopRef.current === 0) {
      lastScrollTopRef.current = container.scrollTop;
      pendingScrollTopRef.current = container.scrollTop;
    }

    // Инициализация переменных для обработки прокрутки
    lastScrollDirectionRef.current = null;
    manualScrollRafRef.current = null;

    let scrollTimeout: ReturnType<typeof setTimeout> | null = null;
    let directionTimeout: ReturnType<typeof setTimeout> | null = null;
    let isProgrammaticScroll = false; // Флаг для отслеживания программного скролла
    let scrollStartPosition = container?.scrollTop ?? 0;

    const applyDirectionChange = (direction: 'up' | 'down') => {
      const now = Date.now();
      if (now < controlsVisibilityCooldownUntilRef.current) {
        trackDebug('applyDirectionChange:suppressed', { direction });
        return;
      }
      const isSeekProtectionActive = now < seekProtectionUntilRef.current;
      if (direction === 'down' && (isSeekingRef.current || isSeekProtectionActive)) {
        trackDebug('applyDirectionChange:seek-suppressed', {
          direction,
          isSeeking: isSeekingRef.current,
          isSeekProtectionActive,
        });
        return;
      }
      if (direction === 'down') {
        if (isCoarsePointerDevice) {
          trackDebug('applyDirectionChange:down-skipped', { reason: 'coarse-pointer' });
          return;
        }
        const suppressionWindow = isCoarsePointerDevice ? 1200 : 500;
        suppressScrollHandlingUntilRef.current = now + suppressionWindow;
        // Синхронизируем состояние: сначала обновляем ref, потом state
        if (controlsVisibleRef.current) {
          controlsVisibleRef.current = false;
          // Очищаем таймер перед скрытием
          if (inactivityTimerRef.current) {
            clearTimeout(inactivityTimerRef.current);
            inactivityTimerRef.current = null;
            trackDebug('applyDirectionChange:clear-timer', { direction });
          }
          // Оборачиваем в setTimeout, чтобы избежать вызова setState во время рендера
          setTimeout(() => {
            setControlsVisible(false);
          }, 0);
        }
        controlsVisibilityCooldownUntilRef.current = now + suppressionWindow;
        trackDebug('applyDirectionChange:down', { suppressionWindow });
      } else {
        suppressScrollHandlingUntilRef.current = now + 400;
        // Синхронизируем состояние: сначала обновляем ref, потом state
        if (!controlsVisibleRef.current) {
          controlsVisibleRef.current = true;
          setControlsVisible(true);
        }
        showControls();
        controlsVisibilityCooldownUntilRef.current = now + 400;
        trackDebug('applyDirectionChange:up');
      }
    };

    const processScroll = (currentScrollTop: number) => {
      const now = Date.now();
      if (now < suppressScrollHandlingUntilRef.current) {
        lastScrollTopRef.current = currentScrollTop;
        return;
      }
      const isSeekProtectionActive = now < seekProtectionUntilRef.current;
      if (isSeekingRef.current || isSeekProtectionActive) {
        lastScrollTopRef.current = currentScrollTop;
        return;
      }

      // Если мы восстанавливали позицию, проверяем, не является ли это событие результатом восстановления
      if ((container as any).__isRestoringScroll) {
        lastScrollTopRef.current = currentScrollTop;
        return;
      }

      // Проверяем, не является ли это событие результатом восстановления позиции
      // Но только если прошло меньше 500мс с момента восстановления
      if (justRestoredScrollRef.current && savedScrollTopRef.current > 0) {
        const timeSinceRestore = Date.now() - userScrollTimestampRef.current;
        if (timeSinceRestore < 500) {
          const diff = Math.abs(currentScrollTop - savedScrollTopRef.current);
          // Если позиция близка к восстановленной (в пределах 10px), это событие от восстановления - игнорируем
          if (diff < 10) {
            lastScrollTopRef.current = currentScrollTop;
            return;
          }
        }
        // Если пользователь действительно прокрутил вручную или прошло достаточно времени, сбрасываем флаг
        justRestoredScrollRef.current = false;
      }

      debugLog('✅ Manual scroll detected!');
      trackDebug('scroll:manual', { currentScrollTop });

      if (isCoarsePointerDevice) {
        resetInactivityTimer();
      }

      // Отменяем любую активную анимацию скролла при ручной прокрутке
      if (smoothScrollAnimationRef.current !== null) {
        cancelAnimationFrame(smoothScrollAnimationRef.current);
        smoothScrollAnimationRef.current = null;
      }

      const scrollHeight = container.scrollHeight;
      const clientHeight = container.clientHeight;
      const isAtEnd = currentScrollTop + clientHeight >= scrollHeight - 10; // 10px допуск
      const distanceFromBottom = Math.max(0, scrollHeight - clientHeight - currentScrollTop);
      const isNearStickyEnd = distanceFromBottom <= STICKY_END_THRESHOLD;
      const previousScrollTop = lastScrollTopRef.current;
      const scrollDelta = currentScrollTop - previousScrollTop;

      // Помечаем, что пользователь прокручивает вручную
      userScrollTimestampRef.current = Date.now();
      isUserScrollingRef.current = true;
      // Сохраняем позицию прокрутки для восстановления при переключении режимов
      savedScrollTopRef.current = currentScrollTop;

      // Если пользователь прокрутил до конца, устанавливаем флаг
      if (isAtEnd) {
        userScrolledToEndRef.current = true;
        debugLog('📍 User scrolled to end');
      } else if (userScrolledToEndRef.current && distanceFromBottom > STICKY_END_THRESHOLD) {
        userScrolledToEndRef.current = false;
        debugLog('📍 User left end zone, reset flag');
      }

      // Устанавливаем режим прозрачности для ручной прокрутки
      // НЕ вызываем setState, если мы восстанавливаем позицию (это предотвратит ошибку React)
      if (!(container as any).__isRestoringScroll) {
        setLyricsOpacityMode((prevMode) => {
          debugLog('🔍 User scrolling detected, prev mode:', prevMode, '-> user-scrolling');
          return 'user-scrolling';
        });
      }

      if (!isCoarsePointerDevice && Math.abs(scrollDelta) > IMMEDIATE_DIRECTION_THRESHOLD) {
        const direction = scrollDelta > 0 ? 'down' : 'up';
        let shouldReactImmediately =
          lastScrollDirectionRef.current !== direction ||
          (direction === 'down' && controlsVisibleRef.current) ||
          (direction === 'up' && !controlsVisibleRef.current);

        if (direction === 'up' && isNearStickyEnd) {
          shouldReactImmediately = false;
        }
        if (shouldReactImmediately) {
          applyDirectionChange(direction);
          lastScrollDirectionRef.current = direction;
        }
      }

      // Обновляем предыдущее значение scrollTop после обработки
      lastScrollTopRef.current = currentScrollTop;

      // Сбрасываем таймеры
      if (scrollTimeout) {
        clearTimeout(scrollTimeout);
      }
      if (directionTimeout) {
        clearTimeout(directionTimeout);
        directionTimeout = null;
      }

      scrollStartPosition = currentScrollTop;

      // Определяем направление только ПОСЛЕ окончания прокрутки (200мс после последнего события)
      // Это предотвращает зацикливание и дёргание анимации
      directionTimeout = setTimeout(() => {
        const finalScrollTop = container.scrollTop;
        const totalDelta = finalScrollTop - scrollStartPosition;
        const finalDistanceFromBottom = Math.max(0, scrollHeight - clientHeight - finalScrollTop);
        const finalIsNearStickyEnd = finalDistanceFromBottom <= STICKY_END_THRESHOLD;

        if (!isCoarsePointerDevice && Math.abs(totalDelta) > 30) {
          if (isSeekingRef.current && totalDelta > 0) {
            scrollStartPosition = finalScrollTop;
            directionTimeout = null;
            return;
          }
          const finalDirection = totalDelta > 0 ? 'down' : 'up';
          let shouldReactFinal =
            lastScrollDirectionRef.current !== finalDirection ||
            (finalDirection === 'down' && controlsVisibleRef.current) ||
            (finalDirection === 'up' && !controlsVisibleRef.current);

          if (finalDirection === 'up' && finalIsNearStickyEnd) {
            shouldReactFinal = false;
          }
          if (shouldReactFinal) {
            applyDirectionChange(finalDirection);
            lastScrollDirectionRef.current = finalDirection;
            trackDebug('scroll:direction-final', {
              direction: finalDirection,
              totalDelta,
              finalDistanceFromBottom,
            });
          }
        }

        // Обновляем начальную позицию для следующей прокрутки
        scrollStartPosition = finalScrollTop;
        directionTimeout = null;
      }, 200); // Определяем направление 200мс после последнего scroll события

      // Устанавливаем таймер для возврата к нормальному режиму через 2 секунды после последнего скролла
      scrollTimeout = setTimeout(() => {
        // НЕ вызываем setState, если мы восстанавливаем позицию
        // Оборачиваем в setTimeout, чтобы избежать вызова setState во время рендера
        if (!(container as any).__isRestoringScroll) {
          setTimeout(() => {
            setLyricsOpacityMode((prevMode) => {
              if (prevMode === 'user-scrolling') {
                isUserScrollingRef.current = false;
                debugLog('🔍 Scroll timeout, opacity mode reset to: normal');
                return 'normal';
              }
              return prevMode;
            });
          }, 0);
        }
      }, 2000);
    };

    const handleScroll = () => {
      // Если это программный скролл или восстановление позиции - игнорируем
      if (isProgrammaticScroll || (container as any).__isRestoringScroll) {
        return;
      }

      // Игнорируем события scroll сразу после добавления обработчика (при первом переключении)
      if (scrollListenerJustAddedRef.current) {
        return;
      }

      pendingScrollTopRef.current = container.scrollTop;

      if (manualScrollRafRef.current !== null) {
        return;
      }

      // Используем requestAnimationFrame для плавной обработки, но для touch-устройств можно обрабатывать сразу
      manualScrollRafRef.current = requestAnimationFrame(() => {
        manualScrollRafRef.current = null;
        processScroll(pendingScrollTopRef.current);
      });
    };

    // Перехватываем программный скролл
    const originalScrollTo = container.scrollTo.bind(container);
    container.scrollTo = function (optionsOrX?: ScrollToOptions | number, y?: number) {
      isProgrammaticScroll = true;

      if (typeof optionsOrX === 'number' && typeof y === 'number') {
        originalScrollTo(optionsOrX, y);
      } else if (optionsOrX !== undefined) {
        originalScrollTo(optionsOrX as ScrollToOptions);
      } else {
        originalScrollTo();
      }

      // Сбрасываем флаг и обновляем начальную позицию после завершения скролла
      // Используем задержку, чтобы дождаться завершения smooth scroll
      setTimeout(() => {
        isProgrammaticScroll = false;
        // Обновляем начальную позицию для отслеживания направления прокрутки
        scrollStartPosition = container.scrollTop;
      }, 300);
    };

    // Устанавливаем флаг ДО добавления обработчика, чтобы заблокировать события scroll
    scrollListenerJustAddedRef.current = true;

    container.addEventListener('scroll', handleScroll, { passive: true });
    // Сохраняем ссылку на обработчик для временного отключения при восстановлении позиции
    (container as any).__scrollHandler = handleScroll;
    debugLog('✅ Scroll event listener added');

    // Сбрасываем флаг через 300мс после добавления обработчика
    setTimeout(() => {
      scrollListenerJustAddedRef.current = false;
    }, 300);

    return () => {
      debugLog('🧹 Cleaning up scroll listener');
      // Очищаем timeout при размонтировании
      const currentContainer = lyricsContainerRef.current;
      if (currentContainer && (currentContainer as any).__restoreTimeoutId) {
        clearTimeout((currentContainer as any).__restoreTimeoutId);
        delete (currentContainer as any).__restoreTimeoutId;
      }
      container.removeEventListener('scroll', handleScroll);
      delete (container as any).__scrollHandler;
      container.scrollTo = originalScrollTo;
      if (scrollTimeout) {
        clearTimeout(scrollTimeout);
      }
      if (directionTimeout) {
        clearTimeout(directionTimeout);
        directionTimeout = null;
      }
      if (manualScrollRafRef.current !== null) {
        cancelAnimationFrame(manualScrollRafRef.current);
        manualScrollRafRef.current = null;
      }
    };
  }, [
    showLyrics,
    resetInactivityTimer,
    isCoarsePointerDevice,
    showControls,
    scheduleControlsHide,
    lyricsContainerRef,
    savedScrollTopRef,
    justRestoredScrollRef,
    userScrollTimestampRef,
    lastScrollTopRef,
    pendingScrollTopRef,
    lastScrollDirectionRef,
    manualScrollRafRef,
    userScrolledToEndRef,
    isUserScrollingRef,
    suppressScrollHandlingUntilRef,
    controlsVisibilityCooldownUntilRef,
    seekProtectionUntilRef,
    isSeekingRef,
    smoothScrollAnimationRef,
    controlsVisibleRef,
    inactivityTimerRef,
    scrollListenerJustAddedRef,
    setLyricsOpacityMode,
    setControlsVisible,
  ]);
}
