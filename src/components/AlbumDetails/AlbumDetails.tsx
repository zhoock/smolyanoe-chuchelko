import React from "react";
import AlbumDetailsReleased from "./AlbumDetailsReleased";
import AlbumDetailsArtwork from "./AlbumDetailsArtwork";
import AlbumDetailsMusic from "./AlbumDetailsMusic";
import { IProduct } from "../../models";
import "./style.scss";

/**
 * Компонент отображает дополнительные данные об альбоме.
 */
export default function AlbumDetails({
  album,
}: {
  album: IProduct
}) {
  return (
    <section className="b-album-details">
      <div className="row">
        <div className="small-12 small-centered column">
          <div className="row">
            <div className="large-5 large-push-7 column">
              <div className="b-album-details__released">
                <h2>Релиз</h2>
                <AlbumDetailsReleased album={album} />
                <hr />
              </div>
              <div className="b-album-details__artwork">
                <h2>Обложка альбома</h2>
                <AlbumDetailsArtwork album={album} />
                <hr />
              </div>
            </div>
            <div className="large-7 large-pull-5 column">
              <div className="b-album-details__music">
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
