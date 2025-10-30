// src/components/ServiceButtons/ServiceButtonsPurchase.tsx
import GetButton from './GetButton';
import { String, IAlbums } from 'models'; // ← используем твои типы
import { useAlbumsData } from '@hooks/data';
import { useLang } from '@contexts/lang';
import { DataAwait } from '@shared/DataAwait';
import './style.scss';

export default function ServiceButtonsPurchase({
  album,
  section, // 'Купить' | 'Слушать'
}: {
  album: IAlbums;
  section: string;
}) {
  // Компонент-кусок, который рендерит сами кнопки.
  function Block({
    itunes,
    bandcamp,
    amazon,
    apple,
    vk,
    youtube,
    spotify,
    yandex,
    deezer,
    tidal,
  }: String) {
    // ← твой тип String
    const { lang } = useLang();
    const data = useAlbumsData(lang);

    const Fallback = ({
      purchaseLabel,
      streamLabel,
    }: {
      purchaseLabel: string;
      streamLabel: string;
    }) => (
      <div className="service-buttons">
        {section === 'Купить' && (
          <>
            <h3>{purchaseLabel}</h3>
            <ul
              className="service-buttons__list"
              aria-label="Блок со ссылками на платные музыкальные агрегаторы"
            >
              <GetButton buttonClass="icon-applemusic" buttonUrl={itunes} buttonText="iTunes" />
              <GetButton buttonClass="icon-bandcamp" buttonUrl={bandcamp} buttonText="Bandcamp" />
              <GetButton buttonClass="icon-amazon" buttonUrl={amazon} buttonText="Amazon" />
            </ul>
          </>
        )}

        {section === 'Слушать' && (
          <>
            <h3>{streamLabel}</h3>
            <ul
              className="service-buttons__list"
              aria-label="Блок со ссылками на бесплатные музыкальные агрегаторы"
            >
              <GetButton buttonClass="icon-apple" buttonUrl={apple} buttonText="Apple Music" />
              <GetButton buttonClass="icon-vk" buttonUrl={vk} buttonText="ВКонтакте" />
              <GetButton buttonClass="icon-youtube1" buttonUrl={youtube} buttonText="YouTube" />
              <GetButton buttonClass="icon-spotify" buttonUrl={spotify} buttonText="Spotify" />
              <GetButton buttonClass="icon-yandex" buttonUrl={yandex} buttonText="Yandex" />
              <GetButton buttonClass="icon-deezer" buttonUrl={deezer} buttonText="Deezer" />
              <GetButton buttonClass="icon-tidal" buttonUrl={tidal} buttonText="Tidal" />
            </ul>
          </>
        )}
      </div>
    );

    if (!data) return <Fallback purchaseLabel="Купить" streamLabel="Слушать" />;

    return (
      <DataAwait
        value={data.templateC}
        fallback={<Fallback purchaseLabel="Купить" streamLabel="Слушать" />}
        error={null}
      >
        {(ui) => {
          const buttons = ui?.[0]?.buttons ?? {};
          return (
            <Fallback
              purchaseLabel={buttons.purchase ?? 'Купить'}
              streamLabel={buttons.stream ?? 'Слушать'}
            />
          );
        }}
      </DataAwait>
    );
  }

  // spread как и раньше; если у album.buttons опционален — закастим к твоему типу
  return <Block {...(album?.buttons as String)} />;
}
