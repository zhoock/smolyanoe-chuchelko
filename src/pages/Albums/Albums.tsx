// src/pages/Albums/Albums.tsx

import { useAlbumsData } from '../../hooks/data';
import { DataAwait } from '../../shared/DataAwait';
import WrapperAlbumCover from '../../components/Album/WrapperAlbumCover';
import AlbumCover from '../../components/Album/AlbumCover';
import { Loader } from '../../components/Loader/Loader';
import ErrorI18n from '../../components/ErrorMessage/ErrorI18n';
import { useLang } from '../../contexts/lang';
import '../../components/Album/style.scss';

/**
 * Компонент отображает список альбомов в виде обложек-ссылок
 */
export default function Albums() {
  const { lang } = useLang();
  const data = useAlbumsData(lang);

  return (
    <section
      className="albums main-background"
      aria-label="Блок c ссылками на альбомы Смоляное чучелко"
    >
      <div className="wrapper">
        <h2>
          {data ? (
            <DataAwait value={data.templateC} fallback={<span>…</span>}>
              {(ui) => ui?.[0]?.titles?.albums}
            </DataAwait>
          ) : (
            <span>…</span>
          )}
        </h2>

        {data ? (
          <DataAwait
            value={data.templateA}
            fallback={<Loader />}
            error={<ErrorI18n code="albumsLoadFailed" />}
          >
            {(albums) => (
              <div className="albums__list">
                {albums.map((album) => (
                  <WrapperAlbumCover key={album.albumId} {...album} date={album.release.date}>
                    <AlbumCover {...album.cover} fullName={album.fullName} />
                  </WrapperAlbumCover>
                ))}
              </div>
            )}
          </DataAwait>
        ) : (
          <Loader />
        )}
      </div>
    </section>
  );
}
