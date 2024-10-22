import React from "react";
import { Link } from "react-router-dom";
import { useParams } from "react-router-dom";

import AlbumDetails from "../AlbumDetails/AlbumDetails";
import AlbumCover from "../Cover/Cover";
import AlbumTracks from "../AlbumTracks/AlbumTracks";
import Share from "../Share/Share";
import ServiceButtons from "../ServiceButtons/ServiceButtons";

import { ALBUMSDATA } from "../data";

/**
 * Компонент отображает основные сведения об альбоме (обложку, список треков, кнопки(ссылки) на музыкальные агрегаторы.
 */
export default function Album() {
  window.scrollTo({
    top: 0,
    left: 0,
    behavior: "smooth",
  });

  const params = useParams<{ albumId: string }>();

  const album = ALBUMSDATA.filter(
    (album) => album.albumId === params.albumId,
  )[0];

  return (
    <>
      <section className="b-album">
        <div className="row">
          <div className="small-12 column">
            <nav aria-label="Breadcrumb" className="b-breadcrumb">
              <ul>
                <li>
                  <Link to="/">Альбомы</Link>
                </li>
                <li className="active">{album.nameAlbum}</li>
              </ul>
            </nav>
          </div>
        </div>
        <div className="row">
          <div className="small-12 medium-6 medium-push-6 column">
            <AlbumCover nameAlbum={album.nameAlbum} />

            <Share />
          </div>

          <div className="small-12 medium-6 medium-pull-6 column">
            <AlbumTracks nameAlbum={album.nameAlbum} />
          </div>
        </div>
        <div className="row">
          <div className="small-12 medium-6 column">
            <ServiceButtons nameAlbum={album.nameAlbum} section="Купить" />
          </div>
          <div className="small-12 medium-6 column">
            <ServiceButtons nameAlbum={album.nameAlbum} section="Слушать" />
          </div>
        </div>
        <AlbumDetails nameAlbum={album.nameAlbum} />
      </section>
    </>
  );
}
