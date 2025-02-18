import React from 'react';
import { NavLink } from 'react-router-dom';
import { NavigationProps } from '../../models';
import './style.scss';

export default function Navigation({ onToggle }: NavigationProps) {
  return (
    <nav role="navigation" className={`header__menu`}>
      <ul className="header__links-list">
        <li className="header__links-list-item">
          <NavLink
            to="/albums"
            title="Альбомы"
            onClick={onToggle}
            className={({ isActive }) => {
              return isActive ? 'active' : '';
            }}
          >
            Альбомы
          </NavLink>
        </li>
        <li className="header__links-list-item">
          <NavLink
            to="/aboutus"
            title="О группе"
            onClick={onToggle}
            className={({ isActive }) => {
              return isActive ? 'active' : '';
            }}
          >
            О группе
          </NavLink>
        </li>
        <li className="header__links-list-item">
          <NavLink
            to="/articles"
            title="Статьи"
            onClick={onToggle}
            className={({ isActive }) => {
              return isActive ? 'active' : '';
            }}
          >
            Статьи
          </NavLink>
        </li>
      </ul>
    </nav>
  );
}
