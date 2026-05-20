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
  /** Подсказка под сообщением; `null` — не показывать блок. */
  irreversibleHint?: string | null;
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

  const showIrreversibleHint = irreversibleHint !== null;
  const irreversibleHintText =
    irreversibleHint === undefined ? 'This action cannot be undone.' : irreversibleHint;

  return (
    <Popup isActive={isOpen} onClose={onCancel} bgColor="rgba(var(--deep-black-rgb) / 95%)">
      <div className="confirmation-modal">
        <div className="confirmation-modal__container">
          <div className="confirmation-modal__header">
            <div className="confirmation-modal__title-row">
              {variant === 'danger' && (
                <span className="confirmation-modal__icon" aria-hidden="true">
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
                    <path
                      d="M12 9v4m0 4h.01M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z"
                      stroke="currentColor"
                      strokeWidth="1.75"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </span>
              )}
              {title && <h2 className="confirmation-modal__title">{title}</h2>}
            </div>
            <button
              type="button"
              className="confirmation-modal__close"
              onClick={handleCancel}
              aria-label={closeLabel}
            >
              ×
            </button>
          </div>
          {message ? <p className="confirmation-modal__message">{message}</p> : null}
          {showIrreversibleHint && irreversibleHintText ? (
            <p className="confirmation-modal__warning">{irreversibleHintText}</p>
          ) : null}
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
