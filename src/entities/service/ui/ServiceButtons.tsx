import { DataAwait } from '@shared/DataAwait';
import { useLang } from '@contexts/lang';
import { useAlbumsData } from '@shared/api/albums';
import type { String, IAlbums } from '@models';
import { GetButton } from './GetButton';
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
  const buttons = album?.buttons as String;

  return (
    <div className="service-buttons">
      {section === 'Купить' && (
        <>
          <h3>{labels.purchase}</h3>
          <ul
            className="service-buttons__list"
            aria-label="Блок со ссылками на платные музыкальные агрегаторы"
          >
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
  const data = useAlbumsData(lang);

  const fallbackLabels = { purchase: 'Купить', stream: 'Слушать' };

  if (!data) {
    return <ServiceButtonsContent album={album} section={section} labels={fallbackLabels} />;
  }

  return (
    <DataAwait
      value={data.templateC}
      fallback={<ServiceButtonsContent album={album} section={section} labels={fallbackLabels} />}
      error={null}
    >
      {(ui) => {
        const buttons = ui?.[0]?.buttons ?? {};
        const labels = {
          purchase: buttons.purchase ?? fallbackLabels.purchase,
          stream: buttons.stream ?? fallbackLabels.stream,
        };
        return <ServiceButtonsContent album={album} section={section} labels={labels} />;
      }}
    </DataAwait>
  );
}

export default ServiceButtons;
