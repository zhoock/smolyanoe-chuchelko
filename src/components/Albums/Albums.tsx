import React from "react";
import { useAlbums } from "../../hooks/albums";
import WrapperAlbumCover from "./WrapperAlbumCover";
import AlbumCover from "./AlbumCover";
import { Loader } from "../Loader/Loader";
import { ErrorMessage } from "../ErrorMessage/ErrorMessage";
import "./style.scss";

/**
 * Компонент отображает список альбомов в виде обложек-ссылок
 */
export default function Albums() {
  const { albums, loading, error } = useAlbums();

  return (
    <section className="albums">
      <div className="row collapse medium-uncollapse">
        <div className="small-12 column">
          <div className="row medium-collapse">
            <div className="small-12 column">
              <h2>Альбомы</h2>
            </div>
          </div>

          {loading && <Loader />}
          {error && <ErrorMessage error={error} />}

          <div className="albums__list">
            {albums.map((album) => (
              <WrapperAlbumCover
                key={album.albumId}
                {...album}
                date={album.release.date}
              >
                <AlbumCover {...album.cover} albumId={album.albumId} />
              </WrapperAlbumCover>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
