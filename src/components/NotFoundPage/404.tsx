import React from 'react';
import { useNavigate } from 'react-router-dom';

import './style.scss';

export default function NotFoundPage() {
  const navigate = useNavigate();

  return (
    <section className="not-found main-background">
      <h2>Страница не найдена</h2>
      <button onClick={() => navigate('/')}>Вернуться на главную</button>
    </section>
  );
}
