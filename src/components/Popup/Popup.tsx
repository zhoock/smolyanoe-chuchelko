import React, { useEffect, useRef } from 'react';
import { PopupProps } from '../../models';
import './style.scss';

export default function Popup({
  children,
  isActive,
  bgColor,
  onClose,
}: PopupProps) {
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

    // Снимаем фокус со всех элементов на мобильных устройствах.
    // setTimeout(() => {
    //   (document.activeElement as HTMLElement)?.blur();
    // }, 0);

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
}
