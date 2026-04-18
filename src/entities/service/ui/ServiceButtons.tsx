import { useLang } from '@app/providers/lang';
import { useAppSelector } from '@shared/lib/hooks/useAppSelector';
import { selectUiDictionaryFirst } from '@shared/model/uiDictionary';
import type { String, IAlbums } from '@models';
import { GetButton } from './GetButton';
import { useCart } from '../model/CartContext';
import {
  hasAlbumPurchaseSectionContent,
  hasAlbumStreamSectionContent,
  hasTruthyButtonUrl,
  isAlbumPaidSaleEnabled,
} from '../lib/albumPurchaseUtils';
import { useYooKassaShopAvailableForAlbum } from '../lib/useYooKassaShopAvailableForAlbum';
import './style.scss';

type ServiceButtonsProps = {
  album: IAlbums;
  section: string;
};

export {
  hasAlbumPurchaseSectionContent,
  hasAlbumStreamSectionContent,
  isAlbumPaidSaleEnabled,
} from '../lib/albumPurchaseUtils';

function ServiceButtonsContent({
  album,
  section,
  labels,
}: {
  album: IAlbums;
  section: string;
  labels: { purchase: string; stream: string };
}) {
  const { addToCart, cartAlbums } = useCart();
  const buttons = album?.buttons as String;

  const isPaidSaleEnabled = isAlbumPaidSaleEnabled(album);
  const hasPurchaseLinks = hasTruthyButtonUrl(buttons, ['itunes', 'bandcamp', 'amazon']);

  const yookassaCheckEnabled = section === 'Купить' && isPaidSaleEnabled;
  const { loading: yookassaLoading, available: yookassaAvailable } =
    useYooKassaShopAvailableForAlbum(album, yookassaCheckEnabled);

  if (section === 'Купить' && !hasAlbumPurchaseSectionContent(album)) {
    return null;
  }
  if (section === 'Слушать' && !hasAlbumStreamSectionContent(album)) {
    return null;
  }

  if (section === 'Купить' && !hasPurchaseLinks && isPaidSaleEnabled) {
    if (yookassaLoading) {
      return null;
    }
    if (!yookassaAvailable) {
      return null;
    }
  }

  const isInCart = album.albumId ? cartAlbums.some((a) => a.albumId === album.albumId) : false;

  const handleDownloadClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault();
    if (!isInCart) {
      addToCart(album);
    }
  };

  const showDownloadButton =
    isPaidSaleEnabled && !yookassaLoading && yookassaAvailable && section === 'Купить';

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
              <li className="service-buttons__list-item">
                <a
                  href="#"
                  className={`service-buttons__link service-buttons__link--download${
                    isInCart ? ' service-buttons__link--in-cart' : ''
                  }`}
                  aria-label={isInCart ? 'Альбом уже в корзине' : 'Скачать альбом'}
                  aria-disabled={isInCart}
                  tabIndex={isInCart ? -1 : 0}
                  onClick={handleDownloadClick}
                >
                  <svg
                    width="24"
                    height="24"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                    <polyline points="7 10 12 15 17 10" />
                    <line x1="12" y1="15" x2="12" y2="3" />
                  </svg>
                  <span className="visually-hidden">Скачать альбом</span>
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
    </div>
  );
}

export function ServiceButtons({ album, section }: ServiceButtonsProps) {
  const { lang } = useLang();
  const ui = useAppSelector((state) => selectUiDictionaryFirst(state, lang));

  // UI словарь загружается через loader

  const fallbackLabels = { purchase: 'Купить', stream: 'Слушать' };
  const buttons = ui?.buttons ?? {};
  const labels = {
    purchase: buttons.purchase ?? fallbackLabels.purchase,
    stream: buttons.stream ?? fallbackLabels.stream,
  };

  return <ServiceButtonsContent album={album} section={section} labels={labels} />;
}

export default ServiceButtons;
