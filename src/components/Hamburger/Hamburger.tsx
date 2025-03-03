import React from 'react';
import { HamburgerProps } from '../../models';
import './style.scss';

/**
 * Компонент отображает гамбургер-меню.
 */
export default function Hamburger({
  isActive,
  onToggle,
  zIndex,
}: HamburgerProps) {
  return (
    <button
      className={`hamburger ${isActive ? 'active' : ''}`}
      onClick={onToggle}
      style={{ zIndex }}
      type="button"
    >
      <span className="one"></span>
      <span className="two"></span>
      <span className="three"></span>
      <span className="visually-hidden">
        {!isActive ? 'Открыть меню' : 'Скрыть меню'}
      </span>
    </button>
  );
}
