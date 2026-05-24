import { useLocation, useNavigate } from 'react-router-dom';
import { useLang } from '@app/providers/lang';
import { useAppSelector } from '@shared/lib/hooks/useAppSelector';
import { selectUiDictionaryFirst } from '@shared/model/uiDictionary';
import type { DashboardOpenIntent } from '@shared/lib/dashboardOpenIntent';
import './ArtistOnboarding.scss';

type OnboardingCardId = 'release' | 'biography' | 'article' | 'social';

function OnboardingCardIcon({ id }: { id: OnboardingCardId }) {
  switch (id) {
    case 'release':
      return (
        <svg viewBox="0 0 24 24" aria-hidden>
          <path
            d="M9 18V5l12-2v13M9 18c0 1.66-1.34 3-3 3s-3-1.34-3-3 1.34-3 3-3 3 1.34 3 3zm12-2c0 1.66-1.34 3-3 3s-3-1.34-3-3 1.34-3 3-3 3 1.34 3 3z"
            fill="currentColor"
          />
        </svg>
      );
    case 'biography':
      return (
        <svg viewBox="0 0 24 24" aria-hidden>
          <path
            d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04a1 1 0 0 0 0-1.41l-2.34-2.34a1 1 0 0 0-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"
            fill="currentColor"
          />
        </svg>
      );
    case 'article':
      return (
        <svg viewBox="0 0 24 24" aria-hidden>
          <path
            d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z"
            fill="currentColor"
          />
        </svg>
      );
    case 'social':
    default:
      return (
        <svg viewBox="0 0 24 24" aria-hidden>
          <path
            d="M3.9 12a5 5 0 0 1 5-5h8.1V5.5H8.9A6.5 6.5 0 0 0 2.4 12a6.5 6.5 0 0 0 6.5 6.5h8.1v-1.5H8.9a5 5 0 0 1-5-5zm16.2 0a5 5 0 0 0-5-5H8.9v1.5h6.2a5 5 0 1 1 0 10H8.9v1.5h6.2a5 5 0 0 0 5-5z"
            fill="currentColor"
          />
        </svg>
      );
  }
}

export function ArtistOnboarding() {
  const { lang } = useLang();
  const location = useLocation();
  const navigate = useNavigate();
  const ui = useAppSelector((state) => selectUiDictionaryFirst(state, lang));
  const copy = ui?.artistOnboarding;

  const openDashboard = (
    tab: 'albums' | 'posts' | 'profile' | 'social-links',
    intent: Omit<DashboardOpenIntent, 'backgroundLocation'>
  ) => {
    navigate(`/dashboard-new/${tab}`, {
      state: {
        backgroundLocation: location,
        ...intent,
      },
    });
  };

  const cards: Array<{
    id: OnboardingCardId;
    title: string;
    description: string;
    button: string;
    onClick: () => void;
  }> = [
    {
      id: 'release',
      title: copy?.cards?.release?.title ?? 'Загрузите первый релиз',
      description:
        copy?.cards?.release?.description ??
        'Добавьте альбом или сингл, чтобы ваша музыка появилась в каталоге.',
      button: copy?.cards?.release?.button ?? 'Загрузить релиз',
      onClick: () => openDashboard('albums', { openEditAlbumModal: true }),
    },
    {
      id: 'biography',
      title: copy?.cards?.biography?.title ?? 'Напишите свою историю',
      description:
        copy?.cards?.biography?.description ??
        'Расскажите о себе, вдохновении и пути. Это поможет слушателям лучше вас понять.',
      button: copy?.cards?.biography?.button ?? 'Добавить биографию',
      onClick: () =>
        openDashboard('profile', {
          openProfileSettingsModal: true,
          profileSettingsTab: 'profile',
        }),
    },
    {
      id: 'article',
      title: copy?.cards?.article?.title ?? 'Опубликуйте первую статью',
      description:
        copy?.cards?.article?.description ??
        'Поделитесь мыслями, опытом или историями о создании музыки.',
      button: copy?.cards?.article?.button ?? 'Написать статью',
      onClick: () => openDashboard('posts', { openNewArticleModal: true }),
    },
    {
      id: 'social',
      title: copy?.cards?.social?.title ?? 'Добавьте соцсети',
      description:
        copy?.cards?.social?.description ??
        'Подключите свои социальные сети, чтобы слушатели могли следить за вами.',
      button: copy?.cards?.social?.button ?? 'Добавить ссылки',
      onClick: () => openDashboard('social-links', {}),
    },
  ];

  return (
    <div className="artist-onboarding main-background">
      <section
        className="artist-onboarding-welcome wrapper"
        aria-labelledby="artist-onboarding-welcome"
      >
        <div className="artist-onboarding-welcome__banner">
          <div className="artist-onboarding-welcome__overlay">
            <h1 id="artist-onboarding-welcome" className="artist-onboarding-welcome__title">
              {copy?.welcomeTitle ?? 'Добро пожаловать в вашу творческую вселенную'}
            </h1>
            <p className="artist-onboarding-welcome__text">
              {copy?.welcomeDescription ??
                'Здесь будет ваша музыка, истории, статьи и всё, что вы создаёте. Заполните профиль, чтобы поделиться своим творчеством с миром.'}
            </p>
          </div>
        </div>
      </section>

      <section
        className="artist-onboarding-cards wrapper"
        aria-labelledby="artist-onboarding-start"
      >
        <h2 id="artist-onboarding-start" className="artist-onboarding-cards__heading">
          {copy?.cardsHeading ?? 'С чего начать?'}
        </h2>
        <ul className="artist-onboarding-cards__grid">
          {cards.map((card) => (
            <li key={card.id} className="artist-onboarding-card">
              <div className="artist-onboarding-card__icon">
                <OnboardingCardIcon id={card.id} />
              </div>
              <h3 className="artist-onboarding-card__title">{card.title}</h3>
              <p className="artist-onboarding-card__description">{card.description}</p>
              <button
                type="button"
                className="artist-onboarding-card__button"
                onClick={card.onClick}
              >
                {card.button}
              </button>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

export default ArtistOnboarding;
