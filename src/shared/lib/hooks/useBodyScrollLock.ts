/**
 * Lock body scroll while a modal/overlay is open.
 *
 * Зачем нужен fixed-body-position pattern (а не просто `body.overflow=hidden`):
 *  - iOS Safari игнорирует `overflow:hidden` на body — пользователь всё равно
 *    скроллит underlying страницу пальцем через модал.
 *  - Поэтому при lock мы фиксируем `body { position:fixed; top:-scrollY }`
 *    что физически останавливает scroll и сохраняет позицию визуально.
 *  - При unlock восстанавливаем style + `window.scrollTo(0, savedScrollY)`,
 *    чтобы underlying page осталась там же, где была.
 *
 * Refcount: несколько модалов могут стоять одновременно (auth + verify-email,
 * dashboard + checkout, и т.д.). Lock применяется один раз на первый активный
 * хук, снимается на последнем — иначе ранний unmount одной модалки сломает
 * прокрутку, пока вторая ещё открыта.
 *
 * Compensation: на десктопе при скрытии scrollbar исчезает gutter и layout
 * "прыгает" вправо. Добавляем `padding-right: scrollbarWidth` пока заблокирован.
 *
 * Height: при `position:fixed` без явной высоты body схлопывается до viewport и
 * `overflow:hidden` обрезает контент ниже fold — под auth-модалкой с backdrop-filter
 * нижняя половина экрана становится чёрной. Сохраняем полную высоту документа до lock.
 */

import { useEffect } from 'react';

type LockState = {
  count: number;
  savedScrollY: number;
  savedBodyStyles: {
    position: string;
    top: string;
    left: string;
    right: string;
    width: string;
    height: string;
    paddingRight: string;
    overflow: string;
  };
  savedHtmlOverflow: string;
};

const lockState: LockState = {
  count: 0,
  savedScrollY: 0,
  savedBodyStyles: {
    position: '',
    top: '',
    left: '',
    right: '',
    width: '',
    height: '',
    paddingRight: '',
    overflow: '',
  },
  savedHtmlOverflow: '',
};

function getScrollbarWidth(): number {
  if (typeof window === 'undefined') return 0;
  return Math.max(0, window.innerWidth - document.documentElement.clientWidth);
}

function getDocumentScrollHeight(): number {
  const { body, documentElement: html } = document;
  return Math.max(body.scrollHeight, html.scrollHeight, html.clientHeight);
}

function applyLock(): void {
  if (typeof document === 'undefined') return;
  const { body, documentElement: html } = document;

  lockState.savedScrollY = window.scrollY;
  const documentScrollHeight = getDocumentScrollHeight();
  lockState.savedBodyStyles = {
    position: body.style.position,
    top: body.style.top,
    left: body.style.left,
    right: body.style.right,
    width: body.style.width,
    height: body.style.height,
    paddingRight: body.style.paddingRight,
    overflow: body.style.overflow,
  };
  lockState.savedHtmlOverflow = html.style.overflow;

  const scrollbarWidth = getScrollbarWidth();

  body.style.position = 'fixed';
  body.style.top = `-${lockState.savedScrollY}px`;
  body.style.left = '0';
  body.style.right = '0';
  body.style.width = '100%';
  body.style.height = `${documentScrollHeight}px`;
  body.style.overflow = 'hidden';
  // Защита от layout shift при исчезновении scrollbar (Windows / некоторые Linux)
  if (scrollbarWidth > 0) {
    const existing = parseFloat(lockState.savedBodyStyles.paddingRight) || 0;
    body.style.paddingRight = `${existing + scrollbarWidth}px`;
  }
  // На случай, если у html был overflow:auto и собственный scrollbar
  html.style.overflow = 'hidden';
}

function releaseLock(): void {
  if (typeof document === 'undefined') return;
  const { body, documentElement: html } = document;

  body.style.position = lockState.savedBodyStyles.position;
  body.style.top = lockState.savedBodyStyles.top;
  body.style.left = lockState.savedBodyStyles.left;
  body.style.right = lockState.savedBodyStyles.right;
  body.style.width = lockState.savedBodyStyles.width;
  body.style.height = lockState.savedBodyStyles.height;
  body.style.paddingRight = lockState.savedBodyStyles.paddingRight;
  body.style.overflow = lockState.savedBodyStyles.overflow;
  html.style.overflow = lockState.savedHtmlOverflow;

  // Возвращаем underlying page на ту же scroll-позицию, где она была.
  // Без этого браузер откатит scroll к 0 после снятия position:fixed.
  window.scrollTo(0, lockState.savedScrollY);
}

/**
 * Block body scroll while `active` is true. Safe to call multiple times
 * across nested modals — counts active locks and only releases on the last.
 */
export function useBodyScrollLock(active: boolean): void {
  useEffect(() => {
    if (!active) return;

    if (lockState.count === 0) {
      applyLock();
    }
    lockState.count += 1;

    return () => {
      lockState.count = Math.max(0, lockState.count - 1);
      if (lockState.count === 0) {
        releaseLock();
      }
    };
  }, [active]);
}

/** @internal Reset for tests — not for production use. */
export function __resetBodyScrollLockForTests(): void {
  if (typeof document !== 'undefined') {
    const { body, documentElement: html } = document;
    body.style.position = '';
    body.style.top = '';
    body.style.left = '';
    body.style.right = '';
    body.style.width = '';
    body.style.height = '';
    body.style.paddingRight = '';
    body.style.overflow = '';
    html.style.overflow = '';
  }
  lockState.count = 0;
  lockState.savedScrollY = 0;
}

/** @internal Test helper to read current lock count. */
export function __getBodyScrollLockCountForTests(): number {
  return lockState.count;
}
