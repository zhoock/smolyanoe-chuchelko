import React from "react";
import { useData, getRandomPhotos } from "../../hooks/albums";
import WrapperAlbumCover from "./WrapperAlbumCover";
import AlbumCover from "./AlbumCover";
import { Loader } from "../Loader/Loader";
import { ErrorMessage } from "../ErrorMessage/ErrorMessage";
import "./style.scss";

/**
 * Компонент отображает список альбомов в виде обложек-ссылок
 */
export default function Albums() {
  getRandomPhotos();
  const { albums, loading, error } = useData();

  return (
    <section className="albums theme-dark">
      <div className="row collapse medium-uncollapse">
        <div className="column">
          <div className="row medium-collapse">
            <div className="column">
              <h2>Альбомы</h2>
            </div>
          </div>

          {/* Элемент показывается только при загрузке данных с сервера */}
          {loading && <Loader />}
          {/* Элемент показывается текст ошибки при ошибке загрузке данных с сервера */}
          {error && <ErrorMessage error={error} />}

          <div className="albums__list">
            {albums.map((album) => (
              <WrapperAlbumCover
                key={album.albumId}
                {...album}
                date={album.release.date}
              >
                <AlbumCover {...album.cover} fullName={album.fullName} />
              </WrapperAlbumCover>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
