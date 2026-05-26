import { useLang } from '@app/providers/lang';
import { useAppSelector } from '@shared/lib/hooks/useAppSelector';
import { selectUiDictionaryFirst } from '@shared/model/uiDictionary';
import type { String, IAlbums } from '@models';
import { useState } from 'react';
import { downloadOwnedAlbumZipByAuth } from '@shared/api/purchases';
import { getAlbumKeyForPaymentApis } from '@shared/lib/payment/albumPaymentKey';
import { useAuthSessionUser } from '@shared/lib/hooks/useAuthSessionUser';
import { GetButton } from './GetButton';
import { AlbumCheckoutModal } from './AlbumCheckoutModal';
import {
  hasAlbumPurchaseSectionContent,
  hasAlbumStreamSectionContent,
  hasTruthyButtonUrl,
  isAlbumPaidSaleEnabled,
  isAlbumViewerOwner,
} from '../lib/albumPurchaseUtils';
import { useYooKassaShopAvailableForAlbum } from '../lib/useYooKassaShopAvailableForAlbum';
import { useAlbumOwnedByViewer } from '../lib/useAlbumOwnedByViewer';
import { getAlbumPrice } from '../lib/getAlbumPrice';
import './style.scss';

type ServiceButtonsProps = {
  album: IAlbums;
  section: string;
};

export {
  hasAlbumPurchaseSectionContent,
  hasAlbumStreamSectionContent,
  isAlbumPaidSaleEnabled,
  isAlbumViewerOwner,
} from '../lib/albumPurchaseUtils';

function ServiceButtonsContent({
  album,
  section,
  labels,
}: {
  album: IAlbums;
  section: string;
  labels: {
    purchase: string;
    stream: string;
    buyAlbum: string;
    buyAlbumPermanentAccess: string;
    buyAlbumPurchased: string;
    buyAlbumOwned: string;
    downloadAlbum: string;
    downloadAlbumLoading: string;
    downloadAlbumPreparing: string;
    errorDownloadingAlbum: string;
  };
}) {
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
  const [albumDownloadState, setAlbumDownloadState] = useState<{
    active: boolean;
    percent: number | null;
  }>({ active: false, percent: null });
  const isDownloadingAlbum = albumDownloadState.active;
  const downloadProgress = albumDownloadState.percent;
  const buttons = album?.buttons as String;
  const viewer = useAuthSessionUser();
  const isAlbumOwnerView = isAlbumViewerOwner(album, viewer?.id);

  const isPaidSaleEnabled = isAlbumPaidSaleEnabled(album);
  const hasPurchaseLinks = hasTruthyButtonUrl(buttons, ['itunes', 'bandcamp', 'amazon']);

  const yookassaCheckEnabled = section === 'Купить' && isPaidSaleEnabled && !isAlbumOwnerView;
  const { loading: yookassaLoading, available: yookassaAvailable } =
    useYooKassaShopAvailableForAlbum(album, yookassaCheckEnabled);

  const downloadButtonEnabled =
    section === 'Купить' &&
    isPaidSaleEnabled &&
    !yookassaLoading &&
    yookassaAvailable &&
    !isAlbumOwnerView;
  const { isOwned, ownedPurchase } = useAlbumOwnedByViewer(album, downloadButtonEnabled);

  if (section === 'Купить' && !hasAlbumPurchaseSectionContent(album)) {
    return null;
  }
  if (section === 'Слушать' && !hasAlbumStreamSectionContent(album)) {
    return null;
  }

  if (section === 'Купить' && !hasPurchaseLinks && isPaidSaleEnabled && !isAlbumOwnerView) {
    if (yookassaLoading) {
      return null;
    }
    if (!yookassaAvailable) {
      return null;
    }
  }

  const showDownloadButton = downloadButtonEnabled;
  const albumKey = getAlbumKeyForPaymentApis(album);
  const albumPrice = showDownloadButton ? getAlbumPrice(album).formatted : '';

  const handlePurchaseButtonClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault();

    if (isOwned) {
      if (isDownloadingAlbum || !albumKey) {
        return;
      }

      const downloadTracks =
        album.tracks?.length > 0
          ? album.tracks.map((track) => ({
              trackId: String(track.id),
              title: track.title,
            }))
          : (ownedPurchase?.tracks ?? []);

      if (downloadTracks.length === 0) {
        alert(labels.errorDownloadingAlbum);
        return;
      }

      void (async () => {
        setAlbumDownloadState({ active: true, percent: null });

        try {
          await downloadOwnedAlbumZipByAuth(
            {
              albumId: albumKey,
              artist: album.artist,
              album: album.album,
              tracks: downloadTracks,
            },
            {
              onProgress: ({ percent }) => {
                setAlbumDownloadState({ active: true, percent });
              },
            }
          );
        } catch (error) {
          console.error('Error downloading album:', error);
          alert(labels.errorDownloadingAlbum);
        } finally {
          setAlbumDownloadState({ active: false, percent: null });
        }
      })();
      return;
    }

    setIsCheckoutOpen(true);
  };

  const purchaseTitle = isDownloadingAlbum
    ? labels.downloadAlbumLoading
    : isOwned
      ? labels.downloadAlbum
      : labels.buyAlbum;
  const purchaseSubtitle = isDownloadingAlbum
    ? downloadProgress !== null
      ? `${downloadProgress}%`
      : labels.downloadAlbumPreparing
    : isOwned
      ? labels.buyAlbumPurchased
      : labels.buyAlbumPermanentAccess;
  const purchaseRightLabel = isOwned || isDownloadingAlbum ? labels.buyAlbumOwned : albumPrice;
  const progressBarValue = downloadProgress ?? 0;

  return (
    <div className="service-buttons">
      {section === 'Купить' && (
        <>
          <h3>{labels.purchase}</h3>
          <ul
            className="service-buttons__list"
            aria-label="Блок со ссылками на платные музыкальные агрегаторы"
          >
            {showDownloadButton && (
              <li className="service-buttons__list-item service-buttons__list-item--buy-album">
                <a
                  href="#"
                  className={`service-buttons__link service-buttons__link--download${
                    isDownloadingAlbum ? ' service-buttons__link--downloading' : ''
                  }${
                    isDownloadingAlbum && downloadProgress === null
                      ? ' service-buttons__link--download-preparing'
                      : ''
                  }`}
                  aria-label={
                    isDownloadingAlbum
                      ? `${labels.downloadAlbumLoading} ${purchaseSubtitle}, ${labels.buyAlbumOwned}`
                      : isOwned
                        ? `${labels.downloadAlbum}, ${labels.buyAlbumPurchased}, ${labels.buyAlbumOwned}`
                        : `${labels.buyAlbum}, ${albumPrice}, ${labels.buyAlbumPermanentAccess}`
                  }
                  aria-disabled={isDownloadingAlbum}
                  aria-busy={isDownloadingAlbum}
                  tabIndex={isDownloadingAlbum ? -1 : 0}
                  onClick={handlePurchaseButtonClick}
                >
                  <span className="service-buttons__download-icon" aria-hidden="true">
                    <svg
                      width="20"
                      height="20"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                      <polyline points="7 10 12 15 17 10" />
                      <line x1="12" y1="15" x2="12" y2="3" />
                    </svg>
                  </span>
                  <span className="service-buttons__download-copy">
                    <span className="service-buttons__download-title">{purchaseTitle}</span>
                    <span className="service-buttons__download-subtitle">{purchaseSubtitle}</span>
                  </span>
                  <span className="service-buttons__download-divider" aria-hidden="true" />
                  <span className="service-buttons__download-price">{purchaseRightLabel}</span>
                  {isDownloadingAlbum && (
                    <span
                      className="service-buttons__download-progress"
                      role="progressbar"
                      aria-valuemin={0}
                      aria-valuemax={100}
                      aria-valuenow={downloadProgress ?? 0}
                      aria-label={purchaseSubtitle}
                    >
                      <span
                        className="service-buttons__download-progress-fill"
                        style={
                          downloadProgress !== null
                            ? {
                                inlineSize: `${progressBarValue}%`,
                                width: `${progressBarValue}%`,
                              }
                            : undefined
                        }
                      />
                    </span>
                  )}
                </a>
              </li>
            )}
            <GetButton
              buttonClass="icon-applemusic"
              buttonUrl={buttons?.itunes}
              buttonText="iTunes"
            />
            <GetButton
              buttonClass="icon-bandcamp"
              buttonUrl={buttons?.bandcamp}
              buttonText="Bandcamp"
            />
            <GetButton buttonClass="icon-amazon" buttonUrl={buttons?.amazon} buttonText="Amazon" />
          </ul>
        </>
      )}

      {section === 'Слушать' && (
        <>
          <h3>{labels.stream}</h3>
          <ul
            className="service-buttons__list"
            aria-label="Блок со ссылками на бесплатные музыкальные агрегаторы"
          >
            <GetButton
              buttonClass="icon-apple"
              buttonUrl={buttons?.apple}
              buttonText="Apple Music"
            />
            <GetButton buttonClass="icon-vk" buttonUrl={buttons?.vk} buttonText="ВКонтакте" />
            <GetButton
              buttonClass="icon-youtube1"
              buttonUrl={buttons?.youtube}
              buttonText="YouTube"
            />
            <GetButton
              buttonClass="icon-spotify"
              buttonUrl={buttons?.spotify}
              buttonText="Spotify"
            />
            <GetButton buttonClass="icon-yandex" buttonUrl={buttons?.yandex} buttonText="Yandex" />
            <GetButton buttonClass="icon-deezer" buttonUrl={buttons?.deezer} buttonText="Deezer" />
            <GetButton buttonClass="icon-tidal" buttonUrl={buttons?.tidal} buttonText="Tidal" />
          </ul>
        </>
      )}

      {section === 'Купить' && showDownloadButton && (
        <AlbumCheckoutModal
          isOpen={isCheckoutOpen}
          album={album}
          onClose={() => setIsCheckoutOpen(false)}
        />
      )}
    </div>
  );
}

export function ServiceButtons({ album, section }: ServiceButtonsProps) {
  const { lang } = useLang();
  const ui = useAppSelector((state) => selectUiDictionaryFirst(state, lang));

  const fallbackLabels =
    lang === 'en'
      ? {
          purchase: 'Purchase',
          stream: 'Stream',
          buyAlbum: 'Buy Album',
          buyAlbumPermanentAccess: 'Permanent access',
          buyAlbumPurchased: 'Purchased',
          buyAlbumOwned: 'Owned',
          downloadAlbum: 'Download Album',
          downloadAlbumLoading: 'Downloading...',
          downloadAlbumPreparing: 'Preparing archive...',
          errorDownloadingAlbum: 'Error downloading album. Please try again.',
        }
      : {
          purchase: 'Купить',
          stream: 'Слушать',
          buyAlbum: 'Купить альбом',
          buyAlbumPermanentAccess: 'Постоянный доступ',
          buyAlbumPurchased: 'Куплено',
          buyAlbumOwned: 'Ваше',
          downloadAlbum: 'Скачать альбом',
          downloadAlbumLoading: 'Скачивание...',
          downloadAlbumPreparing: 'Подготовка архива...',
          errorDownloadingAlbum: 'Ошибка при скачивании альбома. Попробуйте ещё раз.',
        };
  const buttons = ui?.buttons ?? {};
  const labels = {
    purchase: buttons.purchase ?? fallbackLabels.purchase,
    stream: buttons.stream ?? fallbackLabels.stream,
    buyAlbum: buttons.buyAlbum ?? fallbackLabels.buyAlbum,
    buyAlbumPermanentAccess:
      buttons.buyAlbumPermanentAccess ?? fallbackLabels.buyAlbumPermanentAccess,
    buyAlbumPurchased: buttons.buyAlbumPurchased ?? fallbackLabels.buyAlbumPurchased,
    buyAlbumOwned: buttons.buyAlbumOwned ?? fallbackLabels.buyAlbumOwned,
    downloadAlbum: buttons.downloadAlbum ?? fallbackLabels.downloadAlbum,
    downloadAlbumLoading: buttons.downloadAlbumLoading ?? fallbackLabels.downloadAlbumLoading,
    downloadAlbumPreparing: buttons.downloadAlbumPreparing ?? fallbackLabels.downloadAlbumPreparing,
    errorDownloadingAlbum: buttons.errorDownloadingAlbum ?? fallbackLabels.errorDownloadingAlbum,
  };

  return <ServiceButtonsContent album={album} section={section} labels={labels} />;
}

export default ServiceButtons;
