import { useState } from 'react';
import { useLang } from '@app/providers/lang';
import { useAppSelector } from '@shared/lib/hooks/useAppSelector';
import { selectUiDictionaryFirst } from '@shared/model/uiDictionary';
import type { String, IAlbums } from '@models';
import { GetButton } from './GetButton';
import { PurchasePopup } from './PurchasePopup';
import './style.scss';

type ServiceButtonsProps = {
  album: IAlbums;
  section: string;
};

function ServiceButtonsContent({
  album,
  section,
  labels,
}: {
  album: IAlbums;
  section: string;
  labels: { purchase: string; stream: string };
}) {
  const [isPurchasePopupOpen, setIsPurchasePopupOpen] = useState(false);
  const buttons = album?.buttons as String;

  const handleDownloadClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault();
    setIsPurchasePopupOpen(true);
  };

  const handleClosePopup = () => {
    setIsPurchasePopupOpen(false);
  };

  const handleRemove = () => {
    // TODO: Реализовать удаление из корзины
    setIsPurchasePopupOpen(false);
  };

  const handleContinueShopping = () => {
    setIsPurchasePopupOpen(false);
  };

  const handleRegister = () => {
    // TODO: Реализовать переход на регистрацию/оформление заказа
    console.log('Register for checkout');
  };

  return (
    <div className="service-buttons">
      {section === 'Купить' && (
        <>
          <h3>{labels.purchase}</h3>
          <ul
            className="service-buttons__list"
            aria-label="Блок со ссылками на платные музыкальные агрегаторы"
          >
            <li className="service-buttons__list-item">
              <a
                href="#"
                className="service-buttons__link service-buttons__link--download"
                aria-label="Скачать альбом"
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

          <PurchasePopup
            isOpen={isPurchasePopupOpen}
            album={album}
            onClose={handleClosePopup}
            onRemove={handleRemove}
            onContinueShopping={handleContinueShopping}
            onRegister={handleRegister}
          />
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
