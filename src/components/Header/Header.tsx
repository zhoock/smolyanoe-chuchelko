import React from 'react';
import { Link } from 'react-router-dom';
import Navigation from '../Navigation/Navigation';
import './style.scss';

export default function Header() {
  return (
    <>
      <header className="header" role="banner">
        <div className="wrapper header__wrapper">
          <Link className="logo" to="/">
            Home
          </Link>

          <Navigation classes={{ hide: 'hide-for-medium-down' }} />
        </div>
      </header>
    </>
  );
}
