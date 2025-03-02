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
    } else if (!isActive && dialog?.open) {
      dialog.close();
    }

    const handleClose = () => {
      if (onClose) onClose();
    };

    dialog?.addEventListener('close', handleClose);

    return () => {
      dialog?.removeEventListener('close', handleClose);
    };
  }, [isActive, onClose]);

  return (
    <dialog ref={dialogRef} tabIndex={0} style={{ background: bgColor }}>
      <div className="popup__gradient" style={{ background: bgColor }}></div>
      {children}
    </dialog>
  );
}
