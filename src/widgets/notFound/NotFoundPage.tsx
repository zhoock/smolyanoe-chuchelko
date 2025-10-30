// src/components/NotFoundPage/404.tsx
import { useNavigate } from 'react-router-dom';
import './style.scss';

export const NotFoundPage = () => {
  const navigate = useNavigate();

  return (
    <section className="not-found main-background">
      <h2>Страница не найдена</h2>

      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 1024 1024"
        role="img"
        aria-labelledby="t d"
      >
        <title id="t">Smolyanoe Chuchelko — logo</title>
        <desc id="d">
          Двухцветный силуэт головы с пустыми глазами, разрезом рта и «соломой» наверху.
        </desc>

        <style>{`
          :root{
            --logo-dark: var(--text-color, #1f2a25);
            --logo-gold: var(--accent-color, #d6a22c);
          }
          .dark{ fill: var(--logo-dark); }
          .gold{ fill: var(--logo-gold); }
          .gold-stroke{ stroke: var(--logo-gold); }
        `}</style>

        {/* Тело (смоляная масса) */}
        <path
          className="dark"
          d="M512 160c-156 0-280 116-296 251-6 49-2 97 11 142 11 39 8 60-13 99-15 28-11 58 22 86 56 47 144 78 276 78s220-31 276-78c33-28 37-58 22-86-21-39-24-60-13-99 13-45 17-93 11-142C792 276 668 160 512 160Z"
        />

        {/* Пустые глаза (вырезы) */}
        <path
          fill="#0000"
          className="gold"
          d="M355 516c0-42 54-77 113-58 25 9-9 38-28 47-26 13-36 27-55 27-18 0-30-7-30-16Z"
        />
        <path
          fill="#0000"
          className="gold"
          d="M669 516c0-42-54-77-113-58-25 9 9 38 28 47 26 13 36 27 55 27 18 0 30-7 30-16Z"
        />

        {/* Разрез рта (золото) */}
        <path
          className="gold"
          d="M320 636c0-32 86-66 192-66s192 34 192 66-86 52-192 52-192-20-192-52Z"
        />

        {/* Пучки «соломы» */}
        <g fill="none" className="gold-stroke" strokeWidth={18} strokeLinecap="round" opacity=".95">
          <path d="M292 240c40 34 70 58 78 92" />
          <path d="M352 220c56 38 86 68 100 112" />
          <path d="M420 206c46 38 76 74 90 122" />
          <path d="M604 206c-46 38-76 74-90 122" />
          <path d="M672 220c-56 38-86 68-100 112" />
          <path d="M732 240c-40 34-70 58-78 92" />
        </g>

        {/* Тонкая обводка */}
        <path
          fill="none"
          className="gold-stroke"
          strokeWidth={10}
          d="M512 160c-156 0-280 116-296 251-6 49-2 97 11 142 11 39 8 60-13 99-15 28-11 58 22 86 56 47 144 78 276 78s220-31 276-78c33-28 37-58 22-86-21-39-24-60-13-99 13-45 17-93 11-142C792 276 668 160 512 160Z"
        />
      </svg>

      <button type="button" onClick={() => navigate('/', { replace: true })}>
        Вернуться на главную
      </button>
    </section>
  );
};
