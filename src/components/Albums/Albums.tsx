import React from 'react';
import { useData } from '../../hooks/data';
import WrapperAlbumCover from './WrapperAlbumCover';
import AlbumCover from './AlbumCover';
import { Loader } from '../Loader/Loader';
import { ErrorMessage } from '../ErrorMessage/ErrorMessage';

import './style.scss';

/**
 * Компонент отображает список альбомов в виде обложек-ссылок
 */
export default function Albums() {
  const { templateData, loading, error } = useData();

  return (
    <section
      className="albums main-background"
      aria-label="Блок c ссылками на альбомы Смоляное чучелко"
    >
      <div className="wrapper">
        <h2>Альбомы</h2>

        {/* Элемент показывается только при загрузке данных с сервера */}
        {loading && <Loader />}
        {/* Элемент показывается текст ошибки при ошибке загрузке данных с сервера */}
        {error && <ErrorMessage error={error} />}

        <div className="albums__list">
          {templateData.templateA.map((album) => (
            <WrapperAlbumCover
              key={album.albumId}
              {...album}
              date={album.release.date}
            >
              <AlbumCover {...album.cover} fullName={album.fullName} />
            </WrapperAlbumCover>
          ))}
        </div>
      </div>
    </section>
  );
}
