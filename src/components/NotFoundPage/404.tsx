import React from 'react';
import { Link } from 'react-router-dom';

import './style.scss';

export default function NotFoundPage() {
  return (
    <section className="notFound">
      <h2>Страница не найдена</h2>
      <button>
        <Link to="/">Вернуться на главную</Link>
      </button>
    </section>
  );
}
