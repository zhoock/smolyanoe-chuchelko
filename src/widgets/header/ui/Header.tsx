// src/widgets/header/ui/Header.tsx
import { memo, useEffect, useState, useRef } from 'react';
import { Link } from 'react-router-dom';
import clsx from 'clsx';
import { Navigation } from '@features/navigation';
import { useLang } from '@app/providers/lang'; // берём из контекста
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
            />
            <div></div>
          </label>
        </div>
      </div>
    </header>
  );
};

export const Header = memo(HeaderComponent);
