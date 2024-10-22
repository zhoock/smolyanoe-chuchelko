import React from "react";
import { release } from "../data";
import { AlbumsProps } from "../../models";
import { String } from "../../models";

/**
 * Компонент отображает блок с информацией об обложке альбома.
 */
export default function AlbumDetailsArtwork({ nameAlbum }: AlbumsProps) {
  // деструктуризация
  const Block = ({
    photographer,
    photographerURL,
    design,
    designer,
    designerURL,
  }: String) => {
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
  };

  // оператор расширения (или распространения) | spread-оператор | ...
  return <Block {...release(nameAlbum)} />;
}
