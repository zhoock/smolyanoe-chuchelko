import React from "react";
import { ReleaseProps } from "../../models";
import { IProduct } from "../../models";

/**
 * Компонент отображает блок с информацией об обложке альбома.
 */
export default function AlbumDetailsArtwork({ album }: { album: IProduct }) {
  function Block({
    photographer,
    photographerURL,
    design,
    designer,
    designerURL,
  }: ReleaseProps) {
    return (
      <>
        {photographer && (
          <>
            <h3>Фотография</h3>
            <p>
              <a href={photographerURL}>{photographer}</a>
            </p>
          </>
        )}
        <h3>{design}</h3>
        <p>{designerURL ? <a href={designerURL}>{designer}</a> : designer}</p>
      </>
    );
  }

  // оператор расширения (или распространения) | spread-оператор | ...
  return <Block {...album?.release[0]} />;
}
