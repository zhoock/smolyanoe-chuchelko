import { useCallback, useEffect, useId, useState } from 'react';

export interface UseCloseWithUnsavedConfirmationArgs {
  isOpen: boolean;
  /** Блокировать закрытие (например во время сохранения). */
  isBusy?: boolean;
  /** Несохранённые изменения пользователя. */
  hasUnsavedChanges: boolean;
  /** Фактическое закрытие (снять модалку у родителя). */
  onClose: () => void;
}

/**
 * Диалог «Прогресс будет потерян» перед закрытием модалки с несохранённым вводом.
 * Связывает Popup:onClose с requestClose(force) после подтверждения пользователем.
 */
export function useCloseWithUnsavedConfirmation({
  isOpen,
  isBusy = false,
  hasUnsavedChanges,
  onClose,
}: UseCloseWithUnsavedConfirmationArgs) {
  const [discardDialogOpen, setDiscardDialogOpen] = useState(false);
  const discardTitleDomId = useId();

  useEffect(() => {
    if (!isOpen) setDiscardDialogOpen(false);
  }, [isOpen]);

  const dismissDiscardDialog = useCallback(() => setDiscardDialogOpen(false), []);

  const requestClose = useCallback(
    (opts?: { force?: boolean }) => {
      if (isBusy && !opts?.force) return;
      if (!opts?.force && hasUnsavedChanges) {
        setDiscardDialogOpen(true);
        return;
      }
      setDiscardDialogOpen(false);
      onClose();
    },
    [isBusy, hasUnsavedChanges, onClose]
  );

  const finalizeCloseWithoutSaving = useCallback(() => {
    setDiscardDialogOpen(false);
    onClose();
  }, [onClose]);

  return {
    requestClose,
    finalizeCloseWithoutSaving,
    discardDialogOpen,
    discardTitleDomId,
    dismissDiscardDialog,
  };
}
