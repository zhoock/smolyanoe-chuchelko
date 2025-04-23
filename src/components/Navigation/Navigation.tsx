import React from 'react';
import { NavLink } from 'react-router-dom';
import { NavigationProps } from '../../models';
import { useData } from '../../hooks/data';
import { useLang } from '../../hooks/useLang';
import './style.scss';

export default function Navigation({ onToggle }: NavigationProps) {
  const { lang } = useLang();
  const { templateData } = useData(lang);

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
            title={templateData.templateC[0]?.menu.theBand}
            onClick={onToggle}
            className={({ isActive }) => {
              return isActive ? 'active' : '';
            }}
          >
            {templateData.templateC[0]?.menu.theBand}
          </NavLink>
        </li>
        <li className="header__links-list-item">
          <NavLink
            to="/articles"
            title={templateData.templateC[0]?.menu.articles}
            onClick={onToggle}
            className={({ isActive }) => {
              return isActive ? 'active' : '';
            }}
          >
            {templateData.templateC[0]?.menu.articles}
          </NavLink>
        </li>
      </ul>
    </nav>
  );
}
