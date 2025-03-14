import React from 'react';
import { IAlbums, String } from '../../models';
import { useData } from '../../hooks/data';

/**
 * Компонент отображает блок с информацией об обложке альбома.
 */
export default function AlbumDetailsArtwork({ album }: { album: IAlbums }) {
  function Block({
    photographer,
    photographerURL,
    designerURL,
    designer,
  }: String) {
    const { templateData } = useData();

    return (
      <>
        {photographer && (
          <>
            <h3>{templateData.templateC[0]?.titles.photo}</h3>
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
        <h3>{templateData.templateC[0]?.titles.design}</h3>
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
