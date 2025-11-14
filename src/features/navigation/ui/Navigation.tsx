// src/components/Navigation/Navigation.tsx
import { NavLink } from 'react-router-dom';
import clsx from 'clsx';
import { NavigationProps } from '@models';
import { useLang } from '@app/providers/lang';
import { useAppSelector } from '@shared/lib/hooks/useAppSelector';
import { selectUiDictionaryFirst } from '@shared/model/uiDictionary';
import './style.scss';

export const Navigation = ({ onToggle }: NavigationProps) => {
  const { lang } = useLang();
  const ui = useAppSelector((state) => selectUiDictionaryFirst(state, lang));

  // UI словарь загружается через loader

  const fallbackLabels = {
    stems: lang === 'en' ? 'mixer' : 'миксер',
  };

  const menu = ui?.menu ?? {};
  const labels = {
    stems: menu.stems ?? fallbackLabels.stems,
  };

  return (
    <nav className="header__menu">
      <ul className="header__links-list">
        {[{ to: '/stems', label: labels.stems }].map(({ to, label }) => (
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
};
