/**
 * Кастомный компонент для уведомлений
 * Заменяет системные window.alert()
 */

import React from 'react';
import { Popup } from '../popup';
import { Hamburger } from '../hamburger';
import './style.scss';

export interface AlertModalProps {
  isOpen: boolean;
  title?: string;
  message: string;
  buttonText?: string;
  onClose: () => void;
  variant?: 'success' | 'error' | 'warning' | 'info';
}

export function AlertModal({
  isOpen,
  title,
  message,
  buttonText = 'OK',
  onClose,
  variant = 'info',
}: AlertModalProps) {
  return (
    <Popup isActive={isOpen} onClose={onClose} bgColor="rgba(var(--deep-black-rgb) / 95%)">
      <Hamburger isActive onToggle={onClose} />
      <div className="alert-modal">
        <div className="alert-modal__container">
          {title && <h2 className="alert-modal__title">{title}</h2>}
          <p className="alert-modal__message">{message}</p>
          <div className="alert-modal__actions">
            <button
              type="button"
              className={`alert-modal__button alert-modal__button--${variant}`}
              onClick={onClose}
            >
              {buttonText}
            </button>
          </div>
        </div>
      </div>
    </Popup>
  );
}
