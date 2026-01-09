import { useMemo } from 'react';
import './SocialLanding.scss';

const FEATURED_USERNAMES = ['feedback', 'zhoock'] as const;

export function SocialLanding() {
  const featuredProfiles = useMemo(
    () => FEATURED_USERNAMES.map((username) => ({ username, url: `/${username}` })),
    []
  );

  return (
    <section className="social-landing">
      <div className="social-landing__card">
        <h1 className="social-landing__title">Смоляное чучелко становится социальной сетью</h1>
        <p className="social-landing__lead">
          Каждый музыкант получает собственную страницу по адресу вида
          <span className="social-landing__accent"> /username</span>. Это новая главная страница
          проекта.
        </p>

        <p className="social-landing__description">
          Уже доступны первые профили. Переходите на их страницы, чтобы увидеть, как будет выглядеть
          ваше пространство — альбомы, посты и истории остаются рядом с вами и вашим сообществом.
        </p>

        <ul className="social-landing__links">
          {featuredProfiles.map(({ username, url }) => (
            <li key={username} className="social-landing__links-item">
              <a href={url} className="social-landing__link">
                {username}
              </a>
            </li>
          ))}
        </ul>

        <p className="social-landing__hint">
          Хотите собственную страницу? Авторизуйтесь, заполните профиль и расскажите о себе миру.
        </p>
      </div>
    </section>
  );
}

export default SocialLanding;
