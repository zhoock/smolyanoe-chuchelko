import React from "react";
import AlbumDetailsRelease from "./AlbumDetailsRelease";
import AlbumDetailsArtwork from "./AlbumDetailsArtwork";
import AlbumDetailsMusic from "./AlbumDetailsMusic";
import { IAlbums } from "../../models";
import "./style.scss";

/**
 * Компонент отображает дополнительные данные об альбоме.
 */
export default function AlbumDetails({ album }: { album: IAlbums }) {
  return (
    <section className="album-details content-section_theme_bright">
      <div className="row">
        <div className="column">
          <div className="row">
            <div className="large-5 large-push-7 column">
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
            <div className="large-7 large-pull-5 column">
              <div className="album-details__music">
                <h2>Музыка</h2>
                <AlbumDetailsMusic album={album} />
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
