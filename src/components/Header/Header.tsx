// src/components/Header/Header.tsx

import { useEffect, useState, useRef } from 'react';
import { Link } from 'react-router-dom';
import clsx from 'clsx';
import Navigation from '../Navigation/Navigation';
import { useLang } from '../../contexts/lang'; // берём из контекста
import './style.scss';

export const Header = () => {
  const [theme, setTheme] = useState(
    () =>
      localStorage.getItem('theme') ||
      (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
  );

  const { lang, setLang } = useLang(); // язык из контекста
  const [langOpen, setLangOpen] = useState(false);
  const langRef = useRef<HTMLDivElement>(null);

  // Применяем тему
  useEffect(() => {
    document.documentElement.classList.toggle('theme-dark', theme === 'dark');
    document.documentElement.classList.toggle('theme-light', theme === 'light');
    localStorage.setItem('theme', theme);
  }, [theme]);

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

  const toggleTheme = () => {
    setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'));
  };

  const changeLang = (newLang: string) => {
    if (newLang !== lang) setLang(newLang); // ← НИКАКИХ reload
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
              onChange={toggleTheme}
            />
            <div></div>
          </label>
        </div>
      </div>
    </header>
  );
};
