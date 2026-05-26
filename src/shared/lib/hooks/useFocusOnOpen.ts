import { useEffect, useRef, type RefObject } from 'react';

/**
 * Focuses the returned input ref every time `isOpen` flips to `true`.
 *
 * Why this exists: the shared <Popup /> component already runs a
 * `setTimeout(0, () => firstFocusable.focus())` for accessibility, but that
 * "first focusable" is almost always the close (×) button at the top of the
 * modal. For auth/data-entry modals we want focus on the primary input
 * instead, so each modal calls this hook and points the resulting ref at
 * the field it wants focused on open.
 *
 * The hook schedules its `focus()` call slightly after Popup's setTimeout(0)
 * so the input wins the focus race regardless of mount order. A small
 * delay also avoids fighting browser autofill / password-manager UI that
 * sometimes refocuses on the first paint.
 */
export function useFocusOnOpen<T extends HTMLElement>(isOpen: boolean): RefObject<T> {
  // `useRef<T>(null)` is `MutableRefObject<T | null>` at runtime but assignable
  // to `Ref<T>` on JSX `ref={}` props in the React typings used here. Casting
  // the return value keeps the consumer-facing type aligned with that prop so
  // callers don't have to fight the `LegacyRef<T>` constraint.
  const ref = useRef<T | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    const id = window.setTimeout(() => {
      ref.current?.focus();
    }, 30);
    return () => window.clearTimeout(id);
  }, [isOpen]);

  return ref as RefObject<T>;
}
