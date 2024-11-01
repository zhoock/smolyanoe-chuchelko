import React from "react";
import { Link } from "react-router-dom";
import { useParams } from "react-router-dom";
import AlbumDetails from "../AlbumDetails/AlbumDetails";
import AlbumCover from "../AlbumCover/AlbumCover";
import AlbumTracks from "../AlbumTracks/AlbumTracks";
import Share from "../Share/Share";
import ServiceButtons from "../ServiceButtons/ServiceButtons";
import { useAlbums } from "../../hooks/albums";
import { Loader } from "../Loader/Loader";
import { ErrorMessage } from "../ErrorMessage/ErrorMessage";

/**
 * Компонент отображает основные сведения об альбоме (обложку, список треков, кнопки(ссылки) на музыкальные агрегаторы.
 */
export default function Album() {
  window.scrollTo({
    top: 0,
    left: 0,
    behavior: "smooth",
  });

  const { albums, loading, error } = useAlbums();

  const params = useParams<{ albumId: string }>();

  const album = albums.filter((album) => album.albumId === params.albumId)[0];

  return (
    <>
      <section className="album">
        <div className="row">
          <div className="small-12 column">
            <nav aria-label="Breadcrumb" className="breadcrumb">
              <ul>
                <li>
                  <Link to="/">Альбомы</Link>
                </li>
                <li className="active">{album?.nameAlbum}</li>
              </ul>
            </nav>
          </div>
        </div>
        <div className="row">
          <div className="small-12 medium-6 medium-push-6 column">
            <AlbumCover {...album?.cover} albumId={album?.albumId} />

            <Share />
          </div>

          <div className="small-12 medium-6 medium-pull-6 column">
            {loading && <Loader />}
            {error && <ErrorMessage error={error} />}
            <AlbumTracks album={album} />
          </div>
        </div>
        <div className="row">
          <div className="small-12 medium-6 column">
            <ServiceButtons album={album} section="Купить" />
          </div>
          <div className="small-12 medium-6 column">
            <ServiceButtons album={album} section="Слушать" />
          </div>
        </div>
        <AlbumDetails album={album} />
      </section>
    </>
  );
}
