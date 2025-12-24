/**
 * Кастомный компонент для подтверждения действий
 * Заменяет системные window.confirm()
 */

import React from 'react';
import { Popup } from '../popup';
import { Hamburger } from '../hamburger';
import './style.scss';

export interface ConfirmationModalProps {
  isOpen: boolean;
  title?: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  onConfirm: () => void;
  onCancel: () => void;
  variant?: 'danger' | 'warning' | 'info';
}

export function ConfirmationModal({
  isOpen,
  title,
  message,
  confirmText = 'OK',
  cancelText = 'Отмена',
  onConfirm,
  onCancel,
  variant = 'info',
}: ConfirmationModalProps) {
  const handleConfirm = () => {
    onConfirm();
  };

  const handleCancel = () => {
    onCancel();
  };

  return (
    <Popup isActive={isOpen} onClose={onCancel} bgColor="rgba(var(--deep-black-rgb) / 95%)">
      <Hamburger isActive onToggle={onCancel} />
      <div className="confirmation-modal">
        <div className="confirmation-modal__container">
          {title && <h2 className="confirmation-modal__title">{title}</h2>}
          <p className="confirmation-modal__message">{message}</p>
          <p className="confirmation-modal__warning">Это действие нельзя отменить.</p>
          <div className="confirmation-modal__actions">
            <button
              type="button"
              className="confirmation-modal__button confirmation-modal__button--cancel"
              onClick={handleCancel}
            >
              {cancelText}
            </button>
            <button
              type="button"
              className={`confirmation-modal__button confirmation-modal__button--confirm confirmation-modal__button--${variant}`}
              onClick={handleConfirm}
            >
              {confirmText}
            </button>
          </div>
        </div>
      </div>
    </Popup>
  );
}
