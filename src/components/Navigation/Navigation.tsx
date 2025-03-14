import React from 'react';
import { NavLink } from 'react-router-dom';
import { NavigationProps } from '../../models';
import { useData } from '../../hooks/data';
import './style.scss';

export default function Navigation({ onToggle }: NavigationProps) {
  const { templateData } = useData();

  return (
    <nav role="navigation" className={`header__menu`}>
      <ul className="header__links-list">
        <li className="header__links-list-item">
          <NavLink
            to="/albums"
            title={templateData.templateC[0]?.menu.albums}
            onClick={onToggle}
            className={({ isActive }) => {
              return isActive ? 'active' : '';
            }}
          >
            {templateData.templateC[0]?.menu.albums}
          </NavLink>
        </li>
        <li className="header__links-list-item">
          <NavLink
            to="/aboutus"
            title={templateData.templateC[0]?.menu.aboutUs}
            onClick={onToggle}
            className={({ isActive }) => {
              return isActive ? 'active' : '';
            }}
          >
            {templateData.templateC[0]?.menu.aboutUs}
          </NavLink>
        </li>
        <li className="header__links-list-item">
          <NavLink
            to="/articles"
            title={templateData.templateC[0]?.menu.article}
            onClick={onToggle}
            className={({ isActive }) => {
              return isActive ? 'active' : '';
            }}
          >
            {templateData.templateC[0]?.menu.article}
          </NavLink>
        </li>
      </ul>
    </nav>
  );
}
