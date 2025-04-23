import React, { useEffect, useState, useRef } from 'react';
import { Link } from 'react-router-dom';
import Navigation from '../Navigation/Navigation';
import { setLang, getLang } from '../../utils/language';
import './style.scss';

export default function Header() {
  const [theme, setTheme] = useState(
    () =>
      localStorage.getItem('theme') ||
      (window.matchMedia('(prefers-color-scheme: dark)').matches
        ? 'dark'
        : 'light'),
  );
  const [lang, setLangState] = useState(getLang());
  const [langOpen, setLangOpen] = useState(false);
  const langRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    document.documentElement.classList.toggle('theme-dark', theme === 'dark');
    document.documentElement.classList.toggle('theme-light', theme === 'light');
    localStorage.setItem('theme', theme);
  }, [theme]);

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
    if (newLang !== lang) {
      setLang(newLang);
      setLangState(newLang);
      window.location.reload(); // Или убираем это, если хотим без перезагрузки
    }
    setLangOpen(false);
  };

  return (
    <header className="header">
      <div className="wrapper header__wrapper">
        <div className="lang-menu" ref={langRef}>
          <button
            className="lang-current"
            onClick={() => setLangOpen(!langOpen)}
          >
            {lang.toUpperCase()}
          </button>
          {langOpen && (
            <ul className="lang-list">
              <li onClick={() => changeLang('en')}>EN</li>
              <li onClick={() => changeLang('ru')}>RU</li>
            </ul>
          )}
        </div>

        <Link className="logo" to="/">
          Home
        </Link>

        <Navigation />
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
