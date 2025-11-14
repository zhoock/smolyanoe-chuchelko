// src/components/Navigation/Navigation.tsx
import { useEffect } from 'react';
import { NavLink } from 'react-router-dom';
import clsx from 'clsx';
import { NavigationProps } from '@models';
import { useLang } from '@app/providers/lang';
import { useAppDispatch } from '@shared/lib/hooks/useAppDispatch';
import { useAppSelector } from '@shared/lib/hooks/useAppSelector';
import {
  fetchUiDictionary,
  selectUiDictionaryStatus,
  selectUiDictionaryFirst,
} from '@shared/model/uiDictionary';
import './style.scss';

export const Navigation = ({ onToggle }: NavigationProps) => {
  const dispatch = useAppDispatch();
  const { lang } = useLang();
  const status = useAppSelector((state) => selectUiDictionaryStatus(state, lang));
  const ui = useAppSelector((state) => selectUiDictionaryFirst(state, lang));

  useEffect(() => {
    if (status === 'idle' || status === 'failed') {
      const promise = dispatch(fetchUiDictionary({ lang }));
      return () => {
        promise.abort();
      };
    }
  }, [dispatch, lang, status]);

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
