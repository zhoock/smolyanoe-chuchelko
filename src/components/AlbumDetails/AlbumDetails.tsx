import React from 'react';
import AlbumDetailsRelease from './AlbumDetailsRelease';
import AlbumDetailsArtwork from './AlbumDetailsArtwork';
import AlbumDetailsMusic from './AlbumDetailsMusic';
import { String, IAlbums } from '../../models';
import { useData } from '../../hooks/data';
import { useLang } from '../../contexts/lang';
import './style.scss';

/**
 * Компонент отображает дополнительные данные об альбоме.
 */
export default function AlbumDetails({ album }: { album: IAlbums }) {
  const { lang } = useLang();
  const { templateData } = useData(lang);

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

  // оператор расширения или распространения (spread-оператор) ...
  return <Block {...templateData.templateC[0]?.titles} />;
}
