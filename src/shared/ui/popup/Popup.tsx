// src/shared/ui/popup/Popup.tsx
import { memo, useEffect, useRef } from 'react';
import type { PopupProps } from 'models';
import './style.scss';

const PopupComponent = ({
  children,
  isActive,
  bgColor,
  onClose,
  'aria-labelledby': ariaLabelledBy,
}: PopupProps) => {
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (isActive && !dialog.open) {
      dialog.showModal();
      // Фокус на первом фокусируемом элементе внутри dialog для доступности
      // Используем setTimeout для предотвращения конфликтов с расширениями браузера
      setTimeout(() => {
        const firstFocusable = dialog.querySelector<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        firstFocusable?.focus();
      }, 0);
    } else if (!isActive && dialog.open) {
      dialog.close();
    }
  }, [isActive]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    const handleClose = () => {
      onClose?.();
    };

    dialog.addEventListener('close', handleClose);

    return () => {
      dialog.removeEventListener('close', handleClose);
    };
  }, [onClose]);

  return (
    <dialog
      ref={dialogRef}
      className="popup"
      style={{ background: bgColor }}
      aria-modal="true"
      aria-labelledby={ariaLabelledBy}
    >
      <div className="popup__gradient" style={{ background: bgColor }} aria-hidden="true"></div>
      {children}
    </dialog>
  );
};

export const Popup = memo(PopupComponent);
