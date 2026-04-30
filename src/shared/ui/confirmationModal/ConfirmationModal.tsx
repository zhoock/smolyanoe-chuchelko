/**
 * Кастомный компонент для подтверждения действий
 * Заменяет системные window.confirm()
 */

import React from 'react';
import { Popup } from '../popup';
import './style.scss';

export interface ConfirmationModalProps {
  isOpen: boolean;
  title?: string;
  message: string;
  /** Короткая подсказка под сообщением («Это действие нельзя отменить» / локализация). */
  irreversibleHint?: string;
  confirmText?: string;
  cancelText?: string;
  /** aria-label для кнопки «×» (локализация «Закрыть»). */
  closeLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
  variant?: 'danger' | 'warning' | 'info';
}

export function ConfirmationModal({
  isOpen,
  title,
  message,
  irreversibleHint,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  closeLabel = 'Close',
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
      <div className="confirmation-modal">
        <div className="confirmation-modal__container">
          <div className="confirmation-modal__header">
            {title && <h2 className="confirmation-modal__title">{title}</h2>}
            <button
              type="button"
              className="confirmation-modal__close"
              onClick={handleCancel}
              aria-label={closeLabel}
            >
              ×
            </button>
          </div>
          <p className="confirmation-modal__message">{message}</p>
          <p className="confirmation-modal__warning">
            {irreversibleHint ?? 'This action cannot be undone.'}
          </p>
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
