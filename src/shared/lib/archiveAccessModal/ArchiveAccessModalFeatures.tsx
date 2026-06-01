import type { selectUiDictionaryFirst } from '@shared/model/uiDictionary';

function FeatureIconMusic({ className }: { className?: string }) {
  return (
    <svg className={className} width={22} height={22} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M9 18V5l12-2v13M9 9l12-2"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="6" cy="18" r="3" stroke="currentColor" strokeWidth="1.5" />
      <circle cx="18" cy="16" r="3" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

function FeatureIconArticle({ className }: { className?: string }) {
  return (
    <svg className={className} width={22} height={22} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M14 2v6h6M16 13H8M16 17H8M10 9H8"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

function FeatureIconMixer({ className }: { className?: string }) {
  return (
    <svg className={className} width={22} height={22} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M1 14h4M9 8h4M17 16h4"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <circle cx="4" cy="7" r="2" stroke="currentColor" strokeWidth="1.5" />
      <circle cx="12" cy="5" r="2" stroke="currentColor" strokeWidth="1.5" />
      <circle cx="20" cy="9" r="2" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

function FeatureIconDownload({ className }: { className?: string }) {
  return (
    <svg className={className} width={22} height={22} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

type Props = {
  lang: 'ru' | 'en';
  ui: ReturnType<typeof selectUiDictionaryFirst>;
};

export function ArchiveAccessModalFeatures({ lang, ui }: Props) {
  const fTracks =
    ui?.titles?.archiveAccessFeatureTracks ?? (lang === 'en' ? 'Locked tracks' : 'Закрытые треки');
  const fArticles =
    ui?.titles?.archiveAccessFeatureArticles ?? (lang === 'en' ? 'Articles' : 'Статьи');
  const fStems = ui?.titles?.archiveAccessFeatureStems ?? (lang === 'en' ? 'Stems' : 'Стемы');
  const fDownloads =
    ui?.titles?.archiveAccessFeatureDownloads ??
    (lang === 'en' ? 'Album downloads' : 'Скачивание альбомов');

  const features: { Icon: typeof FeatureIconMusic; label: string }[] = [
    { Icon: FeatureIconMusic, label: fTracks },
    { Icon: FeatureIconArticle, label: fArticles },
    { Icon: FeatureIconMixer, label: fStems },
    { Icon: FeatureIconDownload, label: fDownloads },
  ];

  return (
    <ul className="archive-access-modal__features">
      {features.map(({ Icon, label }) => (
        <li key={label} className="archive-access-modal__feature">
          <Icon className="archive-access-modal__feature-icon" />
          <span className="archive-access-modal__feature-label">{label}</span>
        </li>
      ))}
    </ul>
  );
}
