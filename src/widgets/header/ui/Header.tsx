// src/widgets/header/ui/Header.tsx
import { memo, useEffect, useState, useRef, useCallback } from 'react';
import { Link, useLocation } from 'react-router-dom';
import clsx from 'clsx';
import { Navigation } from '@features/navigation';
import { useLang } from '@app/providers/lang'; // берём из контекста
import { useAppSelector } from '@shared/lib/hooks/useAppSelector';
import { selectUiDictionaryFirst } from '@shared/model/uiDictionary';
import { isAuthenticated } from '@shared/lib/auth';
import {
  getStoredProfileAvatarUrl,
  PROFILE_AVATAR_CHANGED_EVENT,
  PROFILE_AVATAR_LOCALSTORAGE_KEY,
} from '@shared/lib/hooks/useAvatar';
import type { SupportedLang } from '@shared/model/lang';
import './style.scss';

const LANG_OPTIONS: SupportedLang[] = ['en', 'ru'];

type Theme = 'light' | 'dark';

type HeaderProps = {
  theme: Theme;
  onToggleTheme: () => void;
};

const HeaderComponent = ({ theme, onToggleTheme }: HeaderProps) => {
  const { lang, setLang } = useLang(); // язык из контекста
  const location = useLocation();
  const ui = useAppSelector((state) => selectUiDictionaryFirst(state, lang));
  const isAuthed = isAuthenticated();
  const [langOpen, setLangOpen] = useState(false);
  const langRef = useRef<HTMLDivElement>(null);
  const [headerAvatarSrc, setHeaderAvatarSrc] = useState(getStoredProfileAvatarUrl);

  const syncHeaderAvatar = useCallback(() => {
    setHeaderAvatarSrc(getStoredProfileAvatarUrl());
  }, []);

  useEffect(() => {
    syncHeaderAvatar();
  }, [location.pathname, location.key, syncHeaderAvatar]);

  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === PROFILE_AVATAR_LOCALSTORAGE_KEY || e.key === null) {
        syncHeaderAvatar();
      }
    };
    window.addEventListener('storage', onStorage);
    window.addEventListener(PROFILE_AVATAR_CHANGED_EVENT, syncHeaderAvatar);
    return () => {
      window.removeEventListener('storage', onStorage);
      window.removeEventListener(PROFILE_AVATAR_CHANGED_EVENT, syncHeaderAvatar);
    };
  }, [syncHeaderAvatar]);

  // Закрываем меню при клике вне
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (langRef.current && !langRef.current.contains(e.target as Node)) {
        setLangOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Смена языка: обновляем Redux, revalidate вызывается в Layout
  const changeLang = (newLang: SupportedLang) => {
    if (newLang !== lang) {
      setLang(newLang); // Обновляем Redux, Layout автоматически вызовет revalidate
    }
    setLangOpen(false);
  };

  return (
    <header className="header">
      <div className="wrapper header__wrapper">
        {/* Языковое меню */}
        <div className="lang-menu" ref={langRef}>
          <button
            className="lang-current"
            onClick={() => setLangOpen(!langOpen)}
            aria-haspopup="listbox"
            aria-expanded={langOpen}
            aria-label={`Выбрать язык. Текущий язык: ${lang === 'ru' ? 'Русский' : 'English'}`}
          >
            {lang.toUpperCase()}
          </button>
          <ul className={clsx('lang-list', { 'is-hidden': !langOpen })} role="listbox">
            {LANG_OPTIONS.map((l) => (
              <li key={l}>
                <button
                  className={clsx('lang-option', { active: lang === l })}
                  onClick={() => changeLang(l)}
                  role="option"
                  aria-selected={lang === l}
                >
                  {l.toUpperCase()}
                </button>
              </li>
            ))}
          </ul>
        </div>

        {/* Лого и навигация */}
        <Link className="logo" to="/">
          Home
        </Link>
        <Navigation />

        <div className="header__end">
          {isAuthed ? (
            <Link
              className="header__profile"
              to="/dashboard-new"
              onClick={() => setLangOpen(false)}
              aria-label={ui?.header?.openProfile ?? 'My profile'}
            >
              <img
                className="header__profile-avatar"
                src={headerAvatarSrc}
                alt=""
                width={36}
                height={36}
                decoding="async"
              />
            </Link>
          ) : (
            <Link
              className="header__sign-in"
              to="/auth?mode=register"
              state={{ backgroundLocation: location }}
              onClick={() => setLangOpen(false)}
            >
              {ui?.header?.signIn ?? 'Sign in'}
            </Link>
          )}
          <div className="theme-toggler">
            <label className="theme-toggler__label">
              <input
                type="checkbox"
                className="theme-toggler__control"
                checked={theme === 'light'}
                onChange={onToggleTheme}
                aria-label={
                  theme === 'light' ? 'Переключить на тёмную тему' : 'Переключить на светлую тему'
                }
              />
              <div></div>
            </label>
          </div>
        </div>
      </div>
    </header>
  );
};

export const Header = memo(HeaderComponent);
