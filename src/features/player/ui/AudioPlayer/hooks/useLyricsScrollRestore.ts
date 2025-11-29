import { useEffect, RefObject } from 'react';
import { debugLog } from '../utils/debug';

interface UseLyricsScrollRestoreParams {
  showLyrics: boolean;
  lyricsContainerRef: RefObject<HTMLDivElement>;
  savedScrollTopRef: React.MutableRefObject<number>;
  justRestoredScrollRef: React.MutableRefObject<boolean>;
  userScrollTimestampRef: React.MutableRefObject<number>;
  lastScrollTopRef: React.MutableRefObject<number>;
  pendingScrollTopRef: React.MutableRefObject<number>;
  time: { current: number };
}

/**
 * Хук для сохранения и восстановления позиции прокрутки текста при переключении режима отображения
 */
export function useLyricsScrollRestore({
  showLyrics,
  lyricsContainerRef,
  savedScrollTopRef,
  justRestoredScrollRef,
  userScrollTimestampRef,
  lastScrollTopRef,
  pendingScrollTopRef,
  time,
}: UseLyricsScrollRestoreParams) {
  // Сохранение позиции прокрутки при скрытии текста
  useEffect(() => {
    if (!showLyrics) {
      const container = lyricsContainerRef.current;
      if (container) {
        // Сохраняем текущую позицию
        savedScrollTopRef.current = container.scrollTop;
        debugLog('💾 Saved scroll position:', savedScrollTopRef.current, 'at time:', time.current);
        justRestoredScrollRef.current = false;
        (container as any).__isRestoringScroll = false;
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showLyrics]); // time.current - это ref, не должен быть в зависимостях

  // Восстановление позиции прокрутки при показе текста
  useEffect(() => {
    if (!showLyrics) {
      return;
    }

    const container = lyricsContainerRef.current;
    if (!container) {
      return;
    }

    // Если есть сохраненная позиция - восстанавливаем её
    if (savedScrollTopRef.current > 0) {
      debugLog('🔄 Restoring saved scroll position:', savedScrollTopRef.current);

      // Устанавливаем флаги ДО прокрутки
      (container as any).__isRestoringScroll = true;
      justRestoredScrollRef.current = true;
      userScrollTimestampRef.current = Date.now();

      // Используем requestAnimationFrame для гарантированного восстановления
      requestAnimationFrame(() => {
        // Мгновенно устанавливаем позицию
        container.scrollTop = savedScrollTopRef.current;
        lastScrollTopRef.current = savedScrollTopRef.current;
        pendingScrollTopRef.current = savedScrollTopRef.current;

        // Двойная проверка через следующий кадр
        requestAnimationFrame(() => {
          if (container.scrollTop !== savedScrollTopRef.current) {
            container.scrollTop = savedScrollTopRef.current;
          }

          // Сбрасываем флаги через время
          setTimeout(() => {
            (container as any).__isRestoringScroll = false;
            setTimeout(() => {
              justRestoredScrollRef.current = false;
              debugLog('✅ Scroll restoration completed');
            }, 1000);
          }, 100);
        });
      });
    }
  }, [
    showLyrics,
    lyricsContainerRef,
    savedScrollTopRef,
    justRestoredScrollRef,
    userScrollTimestampRef,
    lastScrollTopRef,
    pendingScrollTopRef,
  ]);
}
