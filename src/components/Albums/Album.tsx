import React from "react";
import AlbumCover from "../CoverList/AlbumCover";
import AlbumTracks from "../AlbumTracks/AlbumTracks";
import Share from "../Share/Share";
import ServiceButtons from "../ServiceButtons/ServiceButtons";
import { AlbumsProps } from "../../models";

/**
 * Компонент отображает основные сведения об альбоме (обложку, список треков, кнопки(ссылки) на музыкальные агрегаторы.
 */
export default function Album({ nameAlbum, handleCoverClick }: AlbumsProps) {
  window.scrollTo({
    top: 0,
    left: 0,
    behavior: "smooth",
  });

  return (
    <>
      <div className="row">
        <div className="small-12 column">
          <nav aria-label="Breadcrumb" className="b-breadcrumb">
            <ul>
              <li>
                <a href="#" onClick={handleCoverClick}>
                  Альбомы
                </a>
              </li>
              <li className="active">{nameAlbum}</li>
            </ul>
          </nav>
        </div>
      </div>
      <div className="row">
        <div className="small-12 medium-6 medium-push-6 column">
          <AlbumCover nameAlbum={nameAlbum} />

          <Share />
        </div>

        <div className="small-12 medium-6 medium-pull-6 column">
          <AlbumTracks nameAlbum={nameAlbum} />
        </div>
      </div>
      <div className="row">
        <div className="small-12 medium-6 column">
          <ServiceButtons nameAlbum={nameAlbum} section="Купить" />
        </div>
        <div className="small-12 medium-6 column">
          <ServiceButtons nameAlbum={nameAlbum} section="Слушать" />
        </div>
      </div>
    </>
  );
}
