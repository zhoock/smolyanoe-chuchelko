import React from "react";
import { useAlbums } from "../../hooks/albums";
import WrapperCover from "../Cover/WrapperAlbumCover";
import AlbumCover from "../Cover/AlbumCover";
import { Loader } from "../Loader/Loader";
import { ErrorMessage } from "../ErrorMessage/ErrorMessage";
import json from "../../assets/albums.json";
import "./style.scss";

/**
 * Компонент отображает список альбомов в виде обложек-ссылок
 */
export default function Albums() {
  const { albums, loading, error } = useAlbums();

  return (
    <section className="b-albums">
      <div className="row collapse medium-uncollapse">
        <div className="small-12 column">
          <div className="row medium-collapse">
            <div className="small-12 column">
              <h2>Альбомы</h2>
            </div>
          </div>

          {loading && <Loader />}
          {error && <ErrorMessage error={error} />}

          <div className="b-covers-list">
            {albums.map((album) => (
              <WrapperCover
                key={album.albumId}
                fullName={album.fullName}
                year={album.release.date}
                albumId={album.albumId}
              >
                <AlbumCover album={album} />
              </WrapperCover>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
