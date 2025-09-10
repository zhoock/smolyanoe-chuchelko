import React from 'react';
import { Link } from 'react-router-dom';
import { useParams } from 'react-router-dom';
import AlbumDetails from '../../components/AlbumDetails/AlbumDetails';
import AlbumCover from '../../components/Album/AlbumCover';
import AlbumTracks from '../../components/AlbumTracks/AlbumTracks';
import Share from '../../components/Share/Share';
import ServiceButtons from '../../components/ServiceButtons/ServiceButtons';
import { useData } from '../../hooks/data';
import { Loader } from '../../components/Loader/Loader';
import { ErrorMessage } from '../../components/ErrorMessage/ErrorMessage';
import { useLang } from '../../hooks/useLang';

/**
 * Компонент отображает основные сведения об альбоме (обложку, список треков, кнопки(ссылки) на музыкальные агрегаторы.
 */
export default function Album() {
  window.scrollTo({
    top: 0,
    left: 0,
    behavior: 'smooth',
  });

  const { lang } = useLang();
  const { templateData, loading, error } = useData(lang);

  const params = useParams<{ albumId: string }>(); // возвращает все параметры, доступные на этой странице

  const album = templateData.templateA.filter((album) => album.albumId === params.albumId)[0];

  return (
    <section className="album main-background" aria-label="Блок c альбомом">
      <div className="wrapper album__wrapper">
        <nav className="breadcrumb item-type-a" aria-label="Breadcrumb">
          <ul>
            <li>
              <Link to="/albums">{templateData.templateC[0]?.titles.albums}</Link>
            </li>
            <li className="active">{album?.album}</li>
          </ul>
        </nav>

        {/* Элемент показывается только при загрузке данных с сервера */}
        {loading && <Loader />}
        {/* Элемент показывается текст ошибки при ошибке загрузке данных с сервера */}
        {error && <ErrorMessage error={error} />}

        <div className="item">
          <AlbumCover {...album?.cover} fullName={album?.fullName} />
          <Share />
        </div>

        <div className="item">
          <AlbumTracks album={album} />
        </div>

        <div className="item">
          <ServiceButtons album={album} section="Купить" />
        </div>

        <div className="item">
          <ServiceButtons album={album} section="Слушать" />
        </div>
      </div>

      <AlbumDetails album={album} />
    </section>
  );
}
