import AlbumDetailsRelease from './AlbumDetailsRelease';
import AlbumDetailsArtwork from './AlbumDetailsArtwork';
import AlbumDetailsMusic from './AlbumDetailsMusic';
import type { String, IAlbums } from '@models';
import { useAlbumsData } from '@hooks/data';
import { useLang } from '@contexts/lang';
import { DataAwait } from '@shared/DataAwait';
import './style.scss';

/**
 * Компонент отображает дополнительные данные об альбоме.
 */
export default function AlbumDetails({ album }: { album: IAlbums }) {
  const { lang } = useLang();
  const data = useAlbumsData(lang); // берём промисы из лоадера

  function Block({ music, release, albumCover }: String) {
    return (
      <section className="album-details nested-background">
        <hr />
        <div className="wrapper album__wrapper">
          <div className="item">
            <div className="album-details__music">
              <h2>{music}</h2>
              <AlbumDetailsMusic album={album} />
            </div>
          </div>
          <div className="item item-release">
            <div className="album-details__released">
              <h2>{release}</h2>
              <AlbumDetailsRelease album={album} />
              <hr />
            </div>
            <div className="album-details__artwork">
              <h2>{albumCover}</h2>
              <AlbumDetailsArtwork album={album} />
              <hr />
            </div>
          </div>
        </div>
      </section>
    );
  }

  if (!data) {
    // теоретический фоллбек — когда лоадер не вернул данных
    return null;
  }

  return (
    <DataAwait
      value={data.templateC}
      // лёгкий скелет, пока словарь не загрузился
      fallback={
        <section className="album-details nested-background">
          <hr />
          <div className="wrapper album__wrapper" />
        </section>
      }
      error={null}
    >
      {(ui) => {
        const titles = ui?.[0]?.titles as String | undefined;
        if (!titles) return null;
        return <Block {...titles} />;
      }}
    </DataAwait>
  );
}
