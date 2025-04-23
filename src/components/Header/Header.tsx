import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import Navigation from '../Navigation/Navigation';
import { setLang } from '../../utils/language';
import './style.scss';

export default function Header() {
  const getInitialTheme = () => {
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme) return savedTheme; // Если в localStorage есть сохранённая тема, используем её
    return window.matchMedia('(prefers-color-scheme: dark)').matches
      ? 'dark'
      : 'light';
  };

  const [theme, setTheme] = useState(getInitialTheme);

  useEffect(() => {
    document.documentElement.classList.toggle('theme-dark', theme === 'dark');
    document.documentElement.classList.toggle('theme-light', theme === 'light');
    localStorage.setItem('theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'));
  };

  function switchLang(lang: string) {
    setLang(lang);
    window.location.reload(); // принудительно перезагружаем страницу, чтобы подгрузился другой язык
  }

  return (
    <header className="header" role="banner">
      <div className="wrapper header__wrapper">
        <Link className="logo" to="/">
          Home
        </Link>

        <Navigation />

        <button onClick={() => switchLang('en')}>EN</button>
        <button onClick={() => switchLang('ru')}>RU</button>

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
}
