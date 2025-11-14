// src/shared/ui/popup/Popup.tsx
import { memo, useEffect, useRef } from 'react';
import type { PopupProps } from 'models';
import './style.scss';

const PopupComponent = ({ children, isActive, bgColor, onClose }: PopupProps) => {
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (isActive && !dialog.open) {
      dialog.showModal();
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
    <dialog ref={dialogRef} style={{ background: bgColor }}>
      <div className="popup__gradient" style={{ background: bgColor }}></div>
      {children}
    </dialog>
  );
};

export const Popup = memo(PopupComponent);
