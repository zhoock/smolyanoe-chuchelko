// src/shared/ui/popup/Popup.tsx
import { useEffect, useRef } from 'react';
import type { PopupProps } from 'models';
import './style.scss';

export const Popup = ({ children, isActive, bgColor, onClose }: PopupProps) => {
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;

    if (isActive && dialog && !dialog.open) {
      dialog.showModal();
      // dialog.focus(); // Устанавливаем фокус на сам диалог
    } else if (!isActive && dialog?.open) {
      dialog.close();
    }

    const handleClose = () => {
      onClose?.();
    };

    dialog?.addEventListener('close', handleClose);

    return () => {
      dialog?.removeEventListener('close', handleClose);
    };
  }, [isActive, onClose]);

  return (
    <dialog ref={dialogRef} style={{ background: bgColor }}>
      <div className="popup__gradient" style={{ background: bgColor }}></div>
      {children}
    </dialog>
  );
};
