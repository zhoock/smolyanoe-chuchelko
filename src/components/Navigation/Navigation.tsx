// src/components/Navigation/Navigation.tsx

import { NavLink } from 'react-router-dom';
import clsx from 'clsx';
import { NavigationProps } from '../../models';
import { useAlbumsData } from '../../hooks/data';
import { DataAwait } from '../../shared/DataAwait';
import { useLang } from '../../contexts/lang';
import './style.scss';

export const Navigation = ({ onToggle }: NavigationProps) => {
  const { lang } = useLang();
  const data = useAlbumsData(lang);

  const renderMenu = (labels: { albums: string; theBand: string; articles: string }) => (
    <nav className="header__menu">
      <ul className="header__links-list">
        {[
          { to: '/albums', label: labels.albums },
          { to: '/aboutus', label: labels.theBand },
          { to: '/articles', label: labels.articles },
        ].map(({ to, label }) => (
          <li key={to}>
            <NavLink
              to={to}
              title={label ?? undefined}
              onClick={onToggle}
              className={({ isActive, isPending }) =>
                clsx('header__link', { active: isActive, pending: isPending })
              }
            >
              {label}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );

  // Фоллбэки на случай отсутствия данных
  const fallbackLabels = { albums: 'Альбомы', theBand: 'О группе', articles: 'Статьи' };

  if (!data) return renderMenu(fallbackLabels);

  return (
    <DataAwait value={data.templateC} fallback={renderMenu(fallbackLabels)} error={null}>
      {(ui) => {
        const menu = ui?.[0]?.menu ?? fallbackLabels;
        return renderMenu({
          albums: menu.albums ?? fallbackLabels.albums,
          theBand: menu.theBand ?? fallbackLabels.theBand,
          articles: menu.articles ?? fallbackLabels.articles,
        });
      }}
    </DataAwait>
  );
};
