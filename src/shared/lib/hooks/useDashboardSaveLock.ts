import { useCallback, useRef, useState } from 'react';

/**
 * Единый флаг «идёт сохранение» для модалок дашборда: блокировка закрытия и повторных сабмитов.
 * Реентранс по ref, чтобы не зависеть от замыканий в async-обработчиках.
 */
export function useDashboardSaveLock() {
  const [isSaving, setIsSaving] = useState(false);
  const lockRef = useRef(false);

  const withSaving = useCallback(async (fn: () => Promise<void>) => {
    if (lockRef.current) return;
    lockRef.current = true;
    setIsSaving(true);
    try {
      await fn();
    } finally {
      lockRef.current = false;
      setIsSaving(false);
    }
  }, []);

  return { isSaving, withSaving };
}
