import React from 'react';
import { String } from '../../models';
import { IAlbums } from '../../models';

/**
 * Компонент отображает блок с информацией об обложке альбома.
 */
export default function AlbumDetailsArtwork({ album }: { album: IAlbums }) {
  function Block({
    photographer,
    photographerURL,
    design,
    designer,
    designerURL,
  }: String) {
    return (
      <>
        {photographer && (
          <>
            <h3>Фотография</h3>
            <p>
              <a href={photographerURL} target="_blank">
                {photographer}
              </a>
            </p>
          </>
        )}
        <h3>{design}</h3>
        <p>{designerURL ? <a href={designerURL}>{designer}</a> : designer}</p>
      </>
    );
  }

  // оператор расширения (или распространения) | spread-оператор | ...
  return <Block {...album?.release} />;
}
