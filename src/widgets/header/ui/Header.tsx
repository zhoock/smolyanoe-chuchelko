// src/widgets/header/ui/Header.tsx
import { useEffect, useState, useRef } from 'react';
import { Link, useRevalidator } from 'react-router-dom';
import clsx from 'clsx';
import { Navigation } from '@features/navigation';
import { useLang } from '@contexts/lang'; // берём из контекста
import { setCurrentLang } from '@state/langStore'; // для синхронизации с глобальным стором
import './style.scss';

type Theme = 'light' | 'dark';

type HeaderProps = {
  theme: Theme;
  onToggleTheme: () => void;
};

export const Header = ({ theme, onToggleTheme }: HeaderProps) => {
  const { lang, setLang } = useLang(); // язык из контекста
  const [langOpen, setLangOpen] = useState(false);
  const langRef = useRef<HTMLDivElement>(null);

  // revalidate для перезагрузки данных из лоадеров (react-router)
  const { revalidate } = useRevalidator();

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

  // Смена языка: контекст → стор для лоадера → revalidate()
  const changeLang = (newLang: string) => {
    if (newLang !== lang) {
      setLang(newLang); // UI-строки
      setCurrentLang(newLang); // для albumsLoader
      revalidate(); // перезагрузить данные на новом языке
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
            {['en', 'ru'].map((l) => (
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
