import { useSearchParams, Link } from 'react-router-dom';
import type { ReactNode, RefObject } from 'react';

import { useLang } from '@app/providers/lang';
import { useAppSelector } from '@shared/lib/hooks/useAppSelector';
import { selectUiDictionaryFirst } from '@shared/model/uiDictionary';
import { withPublicArtistQuery } from '@shared/lib/artistQuery';
import { SubscriberContentLockIcon } from '@shared/ui/icons/SubscriberContentLockIcon';

import '@shared/ui/popup/style.scss';
import './archiveAccessModal.scss';

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
  dialogRef: RefObject<HTMLDialogElement | null>;
  onClose: () => void;
};

/** Фрагменты `**выделение**` в строке из словаря → `<strong>`. */
function formatDescriptionWithBoldSegments(text: string): ReactNode {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, i) => {
    const inner = /^\*\*([^*]+)\*\*$/.exec(part);
    if (inner) {
      return (
        <strong key={i} className="archive-access-modal__description-em">
          {inner[1]}
        </strong>
      );
    }
    return part;
  });
}

export function ArchiveAccessModalView({ dialogRef, onClose }: Props) {
  const { lang } = useLang() as { lang: 'ru' | 'en' };
  const [searchParams] = useSearchParams();
  const artistSlug = searchParams.get('artist');
  const ui = useAppSelector((state) => selectUiDictionaryFirst(state, lang));

  const title =
    ui?.titles?.archiveAccessTitle ?? (lang === 'en' ? 'Premium Archive' : 'Премиум-архив');
  const descriptionSource =
    ui?.titles?.archiveAccessDescription ??
    (lang === 'en'
      ? 'Unlock exclusive content from any **3 artists** every month.'
      : 'Откройте эксклюзивный контент **у любых 3 артистов** каждый месяц.');

  const fTracks =
    ui?.titles?.archiveAccessFeatureTracks ?? (lang === 'en' ? 'Locked tracks' : 'Закрытые треки');
  const fArticles =
    ui?.titles?.archiveAccessFeatureArticles ?? (lang === 'en' ? 'Articles' : 'Статьи');
  const fStems = ui?.titles?.archiveAccessFeatureStems ?? (lang === 'en' ? 'Stems' : 'Стемы');
  const fDownloads =
    ui?.titles?.archiveAccessFeatureDownloads ??
    (lang === 'en' ? 'Album downloads' : 'Скачивание альбомов');

  const priceAmount = ui?.titles?.archiveAccessPriceAmount ?? '149';
  const priceCurrency = ui?.titles?.archiveAccessPriceCurrency ?? '₽';
  const pricePeriod =
    ui?.titles?.archiveAccessPricePeriod ?? (lang === 'en' ? '/ month' : '/ месяц');
  const subscribeLabel =
    ui?.buttons?.archiveAccessSubscribe ?? (lang === 'en' ? 'Start Premium' : 'Стать Premium');
  const closeLabel = ui?.buttons?.articleLockedDialogClose ?? (lang === 'en' ? 'Close' : 'Закрыть');
  const footnote =
    ui?.titles?.archiveAccessFootnote ??
    (lang === 'en' ? 'Cancel anytime' : 'Отмена в любой момент');

  const subscribeTo = withPublicArtistQuery('/albums', artistSlug);

  const features: { Icon: typeof FeatureIconMusic; label: string }[] = [
    { Icon: FeatureIconMusic, label: fTracks },
    { Icon: FeatureIconArticle, label: fArticles },
    { Icon: FeatureIconMixer, label: fStems },
    { Icon: FeatureIconDownload, label: fDownloads },
  ];

  return (
    <dialog
      ref={dialogRef as RefObject<HTMLDialogElement>}
      className="popup archive-access-modal"
      aria-labelledby="archive-access-modal-title"
      onClick={(e) => {
        if (e.target === dialogRef.current) {
          onClose();
        }
      }}
    >
      <div className="archive-access-modal__panel">
        <button
          type="button"
          className="archive-access-modal__close"
          aria-label={closeLabel}
          onClick={onClose}
        >
          <span aria-hidden>×</span>
        </button>

        <header className="archive-access-modal__header">
          <SubscriberContentLockIcon className="archive-access-modal__header-icon" size={26} />
          <h2 id="archive-access-modal-title" className="archive-access-modal__title">
            {title}
          </h2>
        </header>

        <p className="archive-access-modal__description">
          {formatDescriptionWithBoldSegments(descriptionSource)}
        </p>

        <ul className="archive-access-modal__features">
          {features.map(({ Icon, label }) => (
            <li key={label} className="archive-access-modal__feature">
              <Icon className="archive-access-modal__feature-icon" />
              <span className="archive-access-modal__feature-label">{label}</span>
            </li>
          ))}
        </ul>

        <hr className="archive-access-modal__rule" />

        <div
          className="archive-access-modal__pricing"
          aria-label={`${priceAmount} ${priceCurrency} ${pricePeriod}`}
        >
          <span className="archive-access-modal__price-row">
            <span className="archive-access-modal__price-num">{priceAmount}</span>
            <span className="archive-access-modal__price-currency">{priceCurrency}</span>
            <span className="archive-access-modal__price-period">{pricePeriod}</span>
          </span>
        </div>

        <Link className="archive-access-modal__cta" to={subscribeTo} onClick={onClose}>
          {subscribeLabel}
        </Link>
        <p className="archive-access-modal__footnote">{footnote}</p>
      </div>
    </dialog>
  );
}
