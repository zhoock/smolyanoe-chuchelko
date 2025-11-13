// src/components/Navigation/Navigation.tsx
import { NavLink } from 'react-router-dom';
import clsx from 'clsx';
import { NavigationProps } from '@models';
import { useAlbumsData } from '@shared/api/albums';
import { DataAwait } from '@shared/DataAwait';
import { useLang } from '@contexts/lang';
import './style.scss';

export const Navigation = ({ onToggle }: NavigationProps) => {
  const { lang } = useLang();
  const data = useAlbumsData(lang);

  const renderMenu = (labels: { stems: string }) => (
    <nav className="header__menu">
      <ul className="header__links-list">
        {[{ to: '/stems', label: labels.stems ?? (lang === 'en' ? 'mixer' : 'миксер') }].map(
          ({ to, label }) => (
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
          )
        )}
      </ul>
    </nav>
  );

  // Фоллбэки на случай отсутствия данных
  const fallbackLabels = {
    stems: lang === 'en' ? 'mixer' : 'миксер',
  };

  if (!data) return renderMenu(fallbackLabels);

  return (
    <DataAwait value={data.templateC} fallback={renderMenu(fallbackLabels)} error={null}>
      {(ui) => {
        const menu = ui?.[0]?.menu ?? fallbackLabels;
        return renderMenu({
          stems: menu.stems ?? fallbackLabels.stems,
        });
      }}
    </DataAwait>
  );
};
