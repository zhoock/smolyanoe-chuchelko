// src/components/Navigation/Navigation.tsx
import { memo } from 'react';
import { NavLink } from 'react-router-dom';
import clsx from 'clsx';
import { NavigationProps } from '@models';
import { useLang } from '@app/providers/lang';
import { useAppSelector } from '@shared/lib/hooks/useAppSelector';
import { selectUiDictionaryFirst } from '@shared/model/uiDictionary';
import { useProfileContext } from '@shared/context/ProfileContext';
import './style.scss';

const NavigationComponent = ({ onToggle }: NavigationProps) => {
  const { lang } = useLang();
  const ui = useAppSelector((state) => selectUiDictionaryFirst(state, lang));

  const { username } = useProfileContext();

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
        {[{ to: `/${username}/stems`, label: labels.stems }].map(({ to, label }) => (
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

export const Navigation = memo(NavigationComponent);
