import React from "react";
import CoverList from "../CoverList/CoverList";
import Album from "./Album";
import AlbumDetails from "../AlbumDetails/AlbumDetails";
import { AlbumsProps } from "../../models";

/**
 * Компонент отображает в зависимости от условия (showAlbum) — список альбомов
 * в виде обложек-ссылок, либо выбранный альбом со всей информацией о нём.
 */
export default function Albums({ nameAlbum, showAlbum, handleCoverClick }: AlbumsProps) {
  return (
    <section className="b-album">
      {showAlbum ? (
        <>
          <Album nameAlbum={nameAlbum} handleCoverClick={handleCoverClick} />
          <AlbumDetails nameAlbum={nameAlbum} />
        </>
      ) : (
        <CoverList handleCoverClick={handleCoverClick} />
      )}
    </section>
  );
}
