import React from 'react';
import AlbumDetailsRelease from './AlbumDetailsRelease';
import AlbumDetailsArtwork from './AlbumDetailsArtwork';
import AlbumDetailsMusic from './AlbumDetailsMusic';
import { IAlbums } from '../../models';

import './style.scss';

/**
 * Компонент отображает дополнительные данные об альбоме.
 */
export default function AlbumDetails({ album }: { album: IAlbums }) {
  return (
    <section className="album-details nested-background">
      <hr />
      <div className="wrapper album__wrapper">
        <div className="item">
          <div className="album-details__music">
            <h2>Музыка</h2>
            <AlbumDetailsMusic album={album} />
          </div>
        </div>
        <div className="item item-release">
          <div className="album-details__released">
            <h2>Релиз</h2>
            <AlbumDetailsRelease album={album} />
            <hr />
          </div>
          <div className="album-details__artwork">
            <h2>Обложка альбома</h2>
            <AlbumDetailsArtwork album={album} />
            <hr />
          </div>
        </div>
      </div>
    </section>
  );
}
