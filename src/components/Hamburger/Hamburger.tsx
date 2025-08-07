import React from 'react';
import clsx from 'clsx';
import { HamburgerProps } from '../../models';
import './style.scss';

/**
 * Компонент отображает гамбургер-меню.
 */
export default function Hamburger({ isActive, onToggle, zIndex }: HamburgerProps) {
  return (
    <button
      className={clsx(
        'hamburger', // базовый класс
        isActive && 'active' // добавляется, если isActive === true
      )}
      onClick={onToggle}
      style={{ zIndex }}
      type="button"
    >
      <span className="one"></span>
      <span className="two"></span>
      <span className="three"></span>
      <span className="visually-hidden">{!isActive ? 'Открыть меню' : 'Скрыть меню'}</span>
    </button>
  );
}
