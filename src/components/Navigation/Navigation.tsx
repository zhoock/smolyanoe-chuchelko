import React from 'react';
import { NavLink } from 'react-router-dom';
import clsx from 'clsx';
import { NavigationProps } from '../../models';
import { useData } from '../../hooks/data';
import { useLang } from '../../contexts/lang';
import './style.scss';

export default function Navigation({ onToggle }: NavigationProps) {
  const { lang } = useLang();
  const { templateData } = useData(lang);

  const items = [
    { to: '/albums', label: templateData.templateC[0]?.menu.albums },
    { to: '/aboutus', label: templateData.templateC[0]?.menu.theBand },
    { to: '/articles', label: templateData.templateC[0]?.menu.articles },
  ];

  return (
    <nav className="header__menu">
      <ul className="header__links-list">
        {items.map(({ to, label }) => (
          <li key={to}>
            <NavLink
              to={to}
              title={label}
              onClick={onToggle}
              className={({ isActive, isPending }) =>
                clsx('header__link', { active: isActive, pending: isPending })
              }
              // aria-current выставит сам NavLink при isActive
            >
              {label}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}
