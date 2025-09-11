// src/pages/Albums/Albums.tsx

import { useData } from '../../hooks/data';
import WrapperAlbumCover from '../../components/Album/WrapperAlbumCover';
import AlbumCover from '../../components/Album/AlbumCover';
import { Loader } from '../../components/Loader/Loader';
import { ErrorMessage } from '../../components/ErrorMessage/ErrorMessage';
import { useLang } from '../../contexts/lang';
import '../../components/Album/style.scss';

/**
 * Компонент отображает список альбомов в виде обложек-ссылок
 */
export default function Albums() {
  const { lang } = useLang();
  const { templateData, loading, error } = useData(lang);

  return (
    <section
      className="albums main-background"
      aria-label="Блок c ссылками на альбомы Смоляное чучелко"
    >
      <div className="wrapper">
        <h2>{templateData.templateC?.[0]?.titles?.albums}</h2>

        {/* Элемент показывается только при загрузке данных с сервера */}
        {loading && <Loader />}
        {/* Элемент показывается текст ошибки при ошибке загрузке данных с сервера */}
        {error && <ErrorMessage error={error} />}

        <div className="albums__list">
          {templateData.templateA.map((album) => (
            <WrapperAlbumCover key={album.albumId} {...album} date={album.release.date}>
              <AlbumCover {...album.cover} fullName={album.fullName} />
            </WrapperAlbumCover>
          ))}
        </div>
      </div>
    </section>
  );
}
