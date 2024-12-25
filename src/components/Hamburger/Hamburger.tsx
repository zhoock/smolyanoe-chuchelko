import React from 'react';
import { HamburgerProps } from '../../models';
import './style.scss';

/**
 * Компонент отображает гамбургер-меню.
 */
export default function Hamburger({
  isActive,
  onToggle,
  classes,
  zIndex,
}: HamburgerProps) {
  return (
    <button
      className={`hamburger ${classes?.hide} ${isActive ? 'active' : null}`}
      onClick={onToggle}
      style={{ zIndex: zIndex }}
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
