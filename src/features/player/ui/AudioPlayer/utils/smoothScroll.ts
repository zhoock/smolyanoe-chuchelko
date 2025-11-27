import type { MutableRefObject } from 'react';

/**
 * Easing функция для плавного скролла (ease-out cubic)
 */
export const easeOutCubic = (t: number): number => {
  return 1 - Math.pow(1 - t, 3);
};

/**
 * Параметры для плавного скролла
 */
export interface SmoothScrollParams {
  container: HTMLElement;
  targetScrollTop: number;
  duration?: number;
  isIOSDevice: boolean;
  justRestoredScrollRef: MutableRefObject<boolean>;
  smoothScrollAnimationRef: MutableRefObject<number | null>;
  smoothScrollStartRef: MutableRefObject<number>;
  smoothScrollTargetRef: MutableRefObject<number>;
  smoothScrollStartTimeRef: MutableRefObject<number>;
  lastAutoScrollTimeRef: MutableRefObject<number>;
}

/**
 * Функция плавного скролла (как в Apple Music)
 * На десктопе использует нативный smooth scroll, на iOS - кастомный
 */
export function smoothScrollTo({
  container,
  targetScrollTop,
  duration = 600,
  isIOSDevice,
  justRestoredScrollRef,
  smoothScrollAnimationRef,
  smoothScrollStartRef,
  smoothScrollTargetRef,
  smoothScrollStartTimeRef,
  lastAutoScrollTimeRef,
}: SmoothScrollParams) {
  // Если мы только что восстановили позицию, полностью блокируем автоскролл
  if (justRestoredScrollRef.current || (container as any).__isRestoringScroll) {
    return;
  }

  // На десктопе используем нативный smooth scroll
  if (!isIOSDevice) {
    container.scrollTo({
      top: targetScrollTop,
      behavior: 'smooth',
    });
    lastAutoScrollTimeRef.current = Date.now();
    return;
  }

  // На iOS используем кастомный плавный скролл
  // Отменяем предыдущую анимацию если она есть
  if (smoothScrollAnimationRef.current !== null) {
    cancelAnimationFrame(smoothScrollAnimationRef.current);
  }

  smoothScrollStartRef.current = container.scrollTop;
  smoothScrollTargetRef.current = targetScrollTop;
  smoothScrollStartTimeRef.current = performance.now();

  const animate = () => {
    const elapsed = performance.now() - smoothScrollStartTimeRef.current;
    const progress = Math.min(elapsed / duration, 1);
    const easedProgress = easeOutCubic(progress);

    const currentScrollTop =
      smoothScrollStartRef.current +
      (smoothScrollTargetRef.current - smoothScrollStartRef.current) * easedProgress;

    // Используем scrollTo вместо прямого изменения scrollTop для стабильности маски
    container.scrollTo({
      top: currentScrollTop,
      behavior: 'auto',
    });

    if (progress < 1) {
      smoothScrollAnimationRef.current = requestAnimationFrame(animate);
    } else {
      smoothScrollAnimationRef.current = null;
      lastAutoScrollTimeRef.current = Date.now();
    }
  };

  smoothScrollAnimationRef.current = requestAnimationFrame(animate);
}
