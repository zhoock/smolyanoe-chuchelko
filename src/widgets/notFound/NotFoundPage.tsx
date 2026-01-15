// src/components/NotFoundPage/404.tsx
import { useNavigate } from 'react-router-dom';
import './style.scss';

export const NotFoundPage = () => {
  const navigate = useNavigate();

  return (
    <section className="not-found main-background">
      <img src="/images/users/zhoock/tarbaby/404.png" alt="404 - Страница не найдена" role="img" />

      <button type="button" onClick={() => navigate('/', { replace: true })}>
        Вернуться на главную
      </button>
    </section>
  );
};
