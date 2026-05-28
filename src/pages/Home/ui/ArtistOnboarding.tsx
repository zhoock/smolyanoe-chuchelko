import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { useLang } from '@app/providers/lang';
import { useAppSelector } from '@shared/lib/hooks/useAppSelector';
import { useSiteArtistDisplayName } from '@shared/lib/hooks/useSiteArtistDisplayName';
import { selectUiDictionaryFirst } from '@shared/model/uiDictionary';
import type { DashboardOpenIntent } from '@shared/lib/dashboardOpenIntent';
import './ArtistOnboarding.scss';

type SecondaryFeatureId = 'article' | 'mixer' | 'profile';

function UploadIcon() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden>
      <path
        d="M12 16V4m0 0l-4 4m4-4l4 4M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function LockIcon() {
  return (
    <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden>
      <path
        d="M7 11V8a5 5 0 0 1 10 0v3M6 11h12v10H6V11z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function FeatureIcon({ id }: { id: SecondaryFeatureId }) {
  switch (id) {
    case 'article':
      return (
        <svg viewBox="0 0 24 24" aria-hidden>
          <path
            d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinejoin="round"
          />
        </svg>
      );
    case 'mixer':
      return (
        <svg viewBox="0 0 24 24" aria-hidden>
          <path
            d="M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M2 14h4M10 12h4M18 16h4"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
        </svg>
      );
    case 'profile':
    default:
      return (
        <svg viewBox="0 0 24 24" aria-hidden>
          <circle cx="12" cy="8" r="4" fill="none" stroke="currentColor" strokeWidth="1.5" />
          <path
            d="M4 20c0-3.314 3.582-6 8-6s8 2.686 8 6"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
        </svg>
      );
  }
}

function ChevronIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden>
      <path
        d="M9 6l6 6-6 6"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function ArtistOnboarding() {
  const { lang } = useLang();
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const artistSlug = searchParams.get('artist')?.trim() ?? '';
  const ui = useAppSelector((state) => selectUiDictionaryFirst(state, lang));
  const copy = ui?.artistOnboarding;
  const { displayLabel: artistName } = useSiteArtistDisplayName(lang, { artistSlug });

  const openDashboard = (
    tab: 'albums' | 'posts' | 'profile' | 'mixer',
    intent: Omit<DashboardOpenIntent, 'backgroundLocation'>
  ) => {
    navigate(`/dashboard-new/${tab}`, {
      state: {
        backgroundLocation: location,
        ...intent,
      },
    });
  };

  const greeting = (copy?.welcomeGreeting ?? 'Добро пожаловать, {name}').replace(
    '{name}',
    artistName || '…'
  );

  const secondaryFeatures: Array<{
    id: SecondaryFeatureId;
    title: string;
    description: string;
    onClick: () => void;
  }> = [
    {
      id: 'article',
      title: copy?.features?.article?.title ?? 'Статьи',
      description:
        copy?.features?.article?.description ?? 'Рассказывайте истории, делитесь мыслями и опытом.',
      onClick: () => openDashboard('posts', { openNewArticleModal: true }),
    },
    {
      id: 'mixer',
      title: copy?.features?.mixer?.title ?? 'Миксер стемов',
      description:
        copy?.features?.mixer?.description ?? 'Создавайте, миксуйте и делитесь стемами треков.',
      onClick: () => openDashboard('mixer', {}),
    },
    {
      id: 'profile',
      title: copy?.features?.profile?.title ?? 'Профиль артиста',
      description:
        copy?.features?.profile?.description ?? 'Настройте профиль и покажите свою уникальность.',
      onClick: () =>
        openDashboard('profile', {
          openProfileSettingsModal: true,
          profileSettingsTab: 'profile',
        }),
    },
  ];

  return (
    <div className="artist-onboarding">
      <section className="artist-onboarding-hero" aria-labelledby="artist-onboarding-headline">
        <div className="artist-onboarding-hero__backdrop" aria-hidden="true" />
        <div className="artist-onboarding-hero__scrim" aria-hidden="true" />

        <div className="artist-onboarding-hero__frame wrapper">
          <div className="artist-onboarding-hero__content">
            <p className="artist-onboarding-hero__eyebrow">{greeting}</p>
            <h1 id="artist-onboarding-headline" className="artist-onboarding-hero__headline">
              {copy?.heroHeadline ?? 'Ваше творчество начинается'}{' '}
              <span className="artist-onboarding-hero__headline-accent">
                {copy?.heroHeadlineAccent ?? 'здесь.'}
              </span>
            </h1>
            <p className="artist-onboarding-hero__subtext">
              {copy?.heroSubtext ??
                'Загрузите первый релиз, чтобы появиться в каталоге и поделиться музыкой со слушателями.'}
            </p>
            <button
              type="button"
              className="artist-onboarding-hero__cta"
              onClick={() => openDashboard('albums', { openEditAlbumModal: true })}
            >
              <UploadIcon />
              <span>{copy?.primaryCta ?? 'Загрузить первый релиз'}</span>
            </button>
            <p className="artist-onboarding-hero__catalog-hint">
              <LockIcon />
              <span>{copy?.catalogHint ?? 'Появитесь в каталоге после публикации релиза'}</span>
            </p>
          </div>
        </div>
      </section>

      <section
        className="artist-onboarding-secondary wrapper"
        aria-labelledby="artist-onboarding-secondary-heading"
      >
        <h2
          id="artist-onboarding-secondary-heading"
          className="artist-onboarding-secondary__heading"
        >
          {copy?.secondaryHeading ?? 'Вам также доступно'}
        </h2>
        <ul className="artist-onboarding-secondary__list">
          {secondaryFeatures.map((feature) => (
            <li key={feature.id}>
              <button type="button" className="artist-onboarding-feature" onClick={feature.onClick}>
                <span className="artist-onboarding-feature__icon">
                  <FeatureIcon id={feature.id} />
                </span>
                <span className="artist-onboarding-feature__body">
                  <span className="artist-onboarding-feature__title">{feature.title}</span>
                  <span className="artist-onboarding-feature__description">
                    {feature.description}
                  </span>
                </span>
                <span className="artist-onboarding-feature__chevron">
                  <ChevronIcon />
                </span>
              </button>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

export default ArtistOnboarding;
