import { useEffect, RefObject } from 'react';
import type { SyncedLyricsLine } from '@models';
import { debugLog } from '../utils/debug';

interface UseLyricsAutoScrollParams {
  showLyrics: boolean;
  syncedLyrics: SyncedLyricsLine[] | null;
  lyricsContainerRef: RefObject<HTMLDivElement>;
  currentLineIndexComputed: number | null;
  lineRefs: React.MutableRefObject<Map<number, HTMLDivElement>>;
  justRestoredScrollRef: React.MutableRefObject<boolean>;
  userScrollTimestampRef: React.MutableRefObject<number>;
  userScrolledToEndRef: React.MutableRefObject<boolean>;
  isUserScrollingRef: React.MutableRefObject<boolean>;
  lastAutoScrollTimeRef: React.MutableRefObject<number>;
  smoothScrollAnimationRef: React.MutableRefObject<number | null>;
  autoScrollRafRef: React.MutableRefObject<number | null>;
  isIOSDevice: boolean;
  time: { current: number };
  smoothScrollTo: (container: HTMLElement, targetScrollTop: number, duration?: number) => void;
}

/**
 * Хук для автоматической прокрутки текста к активной строке
 */
export function useLyricsAutoScroll({
  showLyrics,
  syncedLyrics,
  lyricsContainerRef,
  currentLineIndexComputed,
  lineRefs,
  justRestoredScrollRef,
  userScrollTimestampRef,
  userScrolledToEndRef,
  isUserScrollingRef,
  lastAutoScrollTimeRef,
  smoothScrollAnimationRef,
  autoScrollRafRef,
  isIOSDevice,
  time,
  smoothScrollTo,
}: UseLyricsAutoScrollParams) {
  useEffect(() => {
    const container = lyricsContainerRef.current;
    if (!container || !syncedLyrics || syncedLyrics.length === 0 || !showLyrics) return;

    // Если мы только что восстановили позицию прокрутки, блокируем автоскролл
    if (justRestoredScrollRef.current) {
      debugLog('🚫 Blocking auto-scroll: position was just restored');
      return;
    }

    // Throttling: разный для iOS и десктопа
    const now = Date.now();
    const timeSinceLastScroll = now - lastAutoScrollTimeRef.current;
    const SCROLL_THROTTLE = isIOSDevice ? 50 : 50; // мс (уменьшили для iOS чтобы успевать за сменой строк)

    // Если currentLineIndex === null, проверяем, почему:
    // 1. Время до начала текста - прокручиваем к началу
    // 2. Время в промежутке между строками - не прокручиваем к началу, оставляем текущую позицию
    if (currentLineIndexComputed === null) {
      const timeValue = time.current;
      const firstLine = syncedLyrics[0];

      // Если время до начала первой строки - прокручиваем к началу
      if (timeValue < firstLine.startTime) {
        // Проверяем, не прокручивал ли пользователь вручную недавно
        const timeSinceUserScroll = Date.now() - userScrollTimestampRef.current;
        const USER_SCROLL_TIMEOUT = 2000; // 2 секунды

        // Если пользователь прокручивал вручную недавно - не вмешиваемся
        if (timeSinceUserScroll < USER_SCROLL_TIMEOUT) {
          return;
        }

        // Throttling для скролла к началу
        if (timeSinceLastScroll < SCROLL_THROTTLE) {
          return;
        }

        // Используем плавный скролл
        smoothScrollTo(container, 0, isIOSDevice ? 300 : 300);
      }
      // Если время в промежутке между строками - не прокручиваем, оставляем текущую позицию
      // (заглушка будет показана, но прокрутка не изменится)
      return;
    }

    const lineElement = lineRefs.current.get(currentLineIndexComputed);
    if (!lineElement) return;

    // Проверяем, не прокручивал ли пользователь вручную недавно
    const timeSinceUserScroll = Date.now() - userScrollTimestampRef.current;
    const USER_SCROLL_TIMEOUT = 2000; // 2 секунды
    const USER_SCROLL_RETURN_DELAY = 3500; // 3.5 секунды - после этого возвращаемся к активной строке даже если пользователь прокручивал далеко

    // Если мы только что восстановили позицию, не выполняем автоскролл
    // Флаг будет сброшен либо при ручной прокрутке, либо через таймаут
    if (justRestoredScrollRef.current) {
      return;
    }

    // Если пользователь прокручивал вручную недавно - не вмешиваемся
    if (timeSinceUserScroll < USER_SCROLL_TIMEOUT) {
      return;
    }

    // Если пользователь прокрутил до конца, проверяем, дошел ли трек до конца
    if (userScrolledToEndRef.current) {
      const scrollHeight = container.scrollHeight;
      const clientHeight = container.clientHeight;
      const scrollTop = container.scrollTop;
      const isStillAtEnd = scrollTop + clientHeight >= scrollHeight - 10;

      // Если пользователь все еще в конце, проверяем, является ли текущая строка последней
      if (isStillAtEnd) {
        const isLastLine = currentLineIndexComputed === syncedLyrics.length - 1;
        const timeValue = time.current;
        const lastLine = syncedLyrics[syncedLyrics.length - 1];
        const lastLineEndTime = lastLine.endTime !== undefined ? lastLine.endTime : Infinity;

        // Если трек еще не дошел до конца последней строки - не возвращаемся к автоскроллу
        if (timeValue < lastLineEndTime) {
          if (timeSinceUserScroll < USER_SCROLL_RETURN_DELAY) {
            debugLog('📍 User at end (grace period), skipping auto-scroll');
            return;
          }
        }
        // Трек дошел до конца или истек период ожидания - разрешаем автоскролл
        userScrolledToEndRef.current = false;
        debugLog('📍 Allowing auto-scroll after user reached end');
      } else {
        // Пользователь больше не в конце - сбрасываем флаг
        userScrolledToEndRef.current = false;
      }
    }

    // Throttling: пропускаем если прошло мало времени с последнего скролла
    if (timeSinceLastScroll < SCROLL_THROTTLE) {
      return;
    }

    // НЕ сбрасываем режим прозрачности здесь - это делается в handleScroll через таймер
    // Просто сбрасываем флаг для логики автоскролла
    if (isUserScrollingRef.current && timeSinceUserScroll >= USER_SCROLL_TIMEOUT) {
      isUserScrollingRef.current = false;
    }

    const lineTop = lineElement.offsetTop;
    const lineHeight = lineElement.offsetHeight;
    const containerHeight = container.clientHeight;
    const scrollTop = container.scrollTop;

    // Увеличенный отступ сверху, чтобы активная строка была выше (примерно 25-30% высоты контейнера)
    const topOffset = Math.min(containerHeight * 0.25, 120);
    // Отступ снизу (минимальный)
    const bottomOffset = Math.min(containerHeight * 0.1, 40);

    // Вычисляем желаемую позицию скролла (чтобы строка была на 25% от верха)
    const desiredScrollTop = Math.max(0, lineTop - topOffset);
    const currentLineTopRelative = lineTop - scrollTop;

    // Проверяем, находится ли строка в правильной позиции (около 25% от верха)
    const isInCorrectPosition = Math.abs(currentLineTopRelative - topOffset) <= 20;

    // Проверяем, полностью ли видна строка (не обрезана снизу)
    const isFullyVisibleBottom = lineTop + lineHeight <= scrollTop + containerHeight - bottomOffset;

    // ВАЖНО: Если пользователь прокрутил дальше текущей активной строки, не пытаемся прокрутить обратно
    // Это предотвращает конфликт и зацикливание анимации
    const userScrolledAhead = scrollTop > desiredScrollTop + 50; // 50px допуск

    if (userScrolledAhead) {
      if (timeSinceUserScroll < USER_SCROLL_RETURN_DELAY) {
        debugLog('📍 User ahead (grace period), skipping auto-scroll');
        return;
      }
      debugLog('📍 Grace period elapsed, auto-scrolling back to active line');
    }

    // ВАЖНО: Если позиция была восстановлена - БЛОКИРУЕМ автоскролл
    if (justRestoredScrollRef.current || (container as any).__isRestoringScroll) {
      debugLog('🚫 Blocking auto-scroll: position was just restored');
      return;
    }

    // Если строка не в правильной позиции или обрезана - скроллим
    if (!isInCorrectPosition || !isFullyVisibleBottom) {
      // Используем плавный скролл с разной длительностью для iOS и десктопа
      smoothScrollTo(container, desiredScrollTop, isIOSDevice ? 300 : 300);
    }

    return () => {
      // Очищаем анимацию при размонтировании или изменении зависимостей
      if (smoothScrollAnimationRef.current !== null) {
        cancelAnimationFrame(smoothScrollAnimationRef.current);
        smoothScrollAnimationRef.current = null;
      }
      if (autoScrollRafRef.current !== null) {
        cancelAnimationFrame(autoScrollRafRef.current);
        autoScrollRafRef.current = null;
      }
    };
  }, [
    currentLineIndexComputed,
    smoothScrollTo,
    isIOSDevice,
    syncedLyrics,
    time,
    showLyrics,
    lyricsContainerRef,
    lineRefs,
    justRestoredScrollRef,
    userScrollTimestampRef,
    userScrolledToEndRef,
    isUserScrollingRef,
    lastAutoScrollTimeRef,
    smoothScrollAnimationRef,
    autoScrollRafRef,
  ]);
}
