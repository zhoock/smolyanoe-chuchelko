import React from "react";
import { Link } from "react-router-dom";
import { useParams } from "react-router-dom";
import AlbumDetails from "../AlbumDetails/AlbumDetails";
import AlbumCover from "./AlbumCover";
import AlbumTracks from "../AlbumTracks/AlbumTracks";
import Share from "../Share/Share";
import ServiceButtons from "../ServiceButtons/ServiceButtons";
import { useData, getRandomPhotos } from "../../hooks/albums";
import { Loader } from "../Loader/Loader";
import { ErrorMessage } from "../ErrorMessage/ErrorMessage";

/**
 * Компонент отображает основные сведения об альбоме (обложку, список треков, кнопки(ссылки) на музыкальные агрегаторы.
 */
export default function Album() {
  getRandomPhotos();
  window.scrollTo({
    top: 0,
    left: 0,
    behavior: "smooth",
  });
  const { albums, loading, error } = useData();

  const params = useParams<{ albumId: string }>();

  const album = albums.filter((album) => album.albumId === params.albumId)[0];

  return (
    <>
      <section className="album theme-dark">
        <div className="row">
          <div className="column">
            <nav className="breadcrumb" aria-label="Breadcrumb">
              <ul>
                <li>
                  <Link to="/">Альбомы</Link>
                </li>
                <li className="active">{album?.nameAlbum}</li>
              </ul>
            </nav>

            {/* Элемент показывается только при загрузке данных с сервера */}
            {loading && <Loader />}
            {/* Элемент показывается текст ошибки при ошибке загрузке данных с сервера */}
            {error && <ErrorMessage error={error} />}
          </div>
        </div>

        <div className="row">
          <div className="medium-6 medium-push-6 column">
            <AlbumCover {...album?.cover} fullName={album?.fullName} />

            <Share />
          </div>

          <div className="medium-6 medium-pull-6 column">
            <AlbumTracks album={album} />
          </div>
        </div>
        <div className="row">
          <div className="medium-6 column">
            <ServiceButtons album={album} section="Купить" />
          </div>
          <div className="medium-6 column">
            <ServiceButtons album={album} section="Слушать" />
          </div>
        </div>

        <AlbumDetails album={album} />
      </section>
    </>
  );
}
