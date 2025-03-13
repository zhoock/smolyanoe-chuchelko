import React from 'react';
import { IAlbums, String } from '../../models';

/**
 * Компонент отображает блок с информацией об обложке альбома.
 */
export default function AlbumDetailsArtwork({ album }: { album: IAlbums }) {
  function Block({
    photographer,
    photo,
    photographerURL,
    design,
    designer,
    designerURL,
  }: String) {
    return (
      <>
        {photographer && (
          <>
            <h3>{photo}</h3>
            <div className="album-details__artwork-photographer">
              <a
                className="album-details__link"
                href={photographerURL}
                target="_blank"
              >
                {photographer}
              </a>
            </div>
          </>
        )}
        <h3>{design}</h3>
        <div className="album-details__artwork-designer">
          {designerURL ? (
            <a className="album-details__link" href={designerURL}>
              {designer}
            </a>
          ) : (
            designer
          )}
        </div>
      </>
    );
  }

  // оператор расширения (или распространения) | spread-оператор | ...
  return <Block {...album?.release} />;
}
