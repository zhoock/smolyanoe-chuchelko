// src/components/Hamburger/Hamburger.tsx
import { memo } from 'react';
import clsx from 'clsx';
import { HamburgerProps } from '@/models';
import './style.scss';

/**
 * Компонент отображает гамбургер-меню.
 */
const HamburgerComponent = ({ isActive, onToggle, zIndex, className }: HamburgerProps) => {
  return (
    <button
      className={clsx(
        'hamburger', // базовый класс
        isActive && 'active', // добавляется, если isActive === true
        className
      )}
      onClick={onToggle}
      style={{ zIndex }}
      type="button"
    >
      <span className="one" aria-hidden="true"></span>
      <span className="two" aria-hidden="true"></span>
      <span className="three" aria-hidden="true"></span>
      <span className="visually-hidden">{!isActive ? 'Открыть меню' : 'Скрыть меню'}</span>
    </button>
  );
};

export const Hamburger = memo(HamburgerComponent);
