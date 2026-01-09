// src/widgets/header/ui/Header.tsx
import { memo, useEffect, useState, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import clsx from 'clsx';
import { Navigation } from '@features/navigation';
import { useLang } from '@app/providers/lang'; // берём из контекста
import { isAuthenticated, getUser } from '@shared/lib/auth';
import { getUserImageUrl } from '@shared/api/albums';
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
  const [langOpen, setLangOpen] = useState(false);
  const langRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const user = getUser();
  const isAuth = isAuthenticated();
  const isProfileButtonVisible = false;

  // Получаем URL аватара пользователя из localStorage (если был загружен)
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!isAuth || !user?.id) {
      setAvatarUrl(null);
      return;
    }

    // Пытаемся получить из localStorage (если был загружен через useAvatar)
    try {
      const savedUrl = localStorage.getItem('user-avatar-url');
      if (savedUrl && savedUrl.startsWith('http')) {
        setAvatarUrl(savedUrl);
        return;
      }
    } catch (e) {
      // Игнорируем ошибки
    }

    // Пытаемся получить из Supabase Storage
    try {
      const storageUrl = getUserImageUrl('profile', 'profile', '.png', true);
      if (storageUrl && storageUrl.startsWith('http')) {
        setAvatarUrl(storageUrl);
      } else {
        setAvatarUrl(null);
      }
    } catch (e) {
      setAvatarUrl(null);
    }
  }, [isAuth, user?.id]);

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

        {/* Переключатель темы */}
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

        {/* Иконка профиля */}
        {/* TODO(Codex): временно скрываем кнопку профиля */}
        {isAuth && isProfileButtonVisible && (
          <button
            className="header__profile-button"
            onClick={() => navigate('/dashboard')}
            aria-label="Перейти в личный кабинет"
            title="Личный кабинет"
          >
            {avatarUrl ? (
              <img
                src={avatarUrl ?? ''}
                alt={user?.name || user?.email || 'Profile'}
                className="header__profile-avatar"
              />
            ) : (
              <svg
                className="header__profile-icon"
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  d="M12 12C14.7614 12 17 9.76142 17 7C17 4.23858 14.7614 2 12 2C9.23858 2 7 4.23858 7 7C7 9.76142 9.23858 12 12 12Z"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <path
                  d="M20.59 22C20.59 18.13 16.74 15 12 15C7.26 15 3.41 18.13 3.41 22"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            )}
          </button>
        )}
      </div>
    </header>
  );
};

export const Header = memo(HeaderComponent);
