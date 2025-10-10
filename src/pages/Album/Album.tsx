// src/pages/Album/Album.tsx

import { useEffect } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';

import AlbumDetails from '../../components/AlbumDetails/AlbumDetails';
import AlbumCover from '../../components/Album/AlbumCover';
import AlbumTracks from '../../components/AlbumTracks/AlbumTracks';
import Share from '../../components/Share/Share';
import ServiceButtons from '../../components/ServiceButtons/ServiceButtons';
import ErrorI18n from '../../components/ErrorMessage/ErrorI18n';
import { useAlbumsData } from '../../hooks/data';
import { DataAwait } from '../../shared/DataAwait';
import { Loader } from '../../components/Loader/Loader';
import { useLang } from '../../contexts/lang';

export default function Album() {
  const { lang } = useLang();
  const data = useAlbumsData(lang);
  const { albumId = '' } = useParams<{ albumId: string }>();

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'smooth' });
  }, [albumId]);

  if (!data) {
    return (
      <section className="album main-background" aria-label="Блок c альбомом">
        <div className="wrapper album__wrapper">
          <Loader />
        </div>
      </section>
    );
  }

  return (
    <section className="album main-background" aria-label="Блок c альбомом">
      <DataAwait
        value={data.templateA}
        fallback={
          <div className="wrapper album__wrapper">
            <Loader />
          </div>
        }
        error={
          <div className="wrapper album__wrapper">
            <ErrorI18n code="albumLoadFailed" />
          </div>
        }
      >
        {(albums) => {
          const album = albums.find((a) => a.albumId === albumId);

          if (!album) {
            return (
              <div className="wrapper album__wrapper">
                <nav className="breadcrumb item-type-a" aria-label="Breadcrumb">
                  <ul>
                    <li>
                      <DataAwait value={data.templateC} fallback={<span>…</span>}>
                        {(ui) => <Link to="/albums">{ui?.[0]?.titles?.albums ?? '…'}</Link>}
                      </DataAwait>
                    </li>
                    <li className="active">—</li>
                  </ul>
                </nav>
                <ErrorI18n code="albumLoadFailed" />
              </div>
            );
          }

          // SEO (RU/EN) для конкретного альбома
          const seoTitle = album.fullName;
          const seoDesc = album.description;

          const canonical =
            lang === 'en'
              ? `https://smolyanoechuchelko.ru/en/albums/${album.albumId}`
              : `https://smolyanoechuchelko.ru/albums/${album.albumId}`;

          return (
            <>
              <Helmet>
                <title>{seoTitle}</title>
                <meta name="description" content={seoDesc} />
                <meta property="og:type" content="music.album" />
                <meta property="og:title" content={seoTitle} />
                <meta property="og:description" content={seoDesc} />
                <meta property="og:url" content={canonical} />
                <link rel="canonical" href={canonical} />
              </Helmet>

              <div className="wrapper album__wrapper">
                <nav className="breadcrumb item-type-a" aria-label="Breadcrumb">
                  <ul>
                    <li>
                      <DataAwait value={data.templateC} fallback={<span>…</span>}>
                        {(ui) => <Link to="/albums">{ui?.[0]?.titles?.albums ?? '…'}</Link>}
                      </DataAwait>
                    </li>
                    <li className="active">{album.album}</li>
                  </ul>
                </nav>

                <div className="item">
                  <AlbumCover {...album.cover} fullName={album.fullName} />
                  <Share />
                </div>

                <div className="item">
                  <AlbumTracks album={album} />
                </div>

                <div className="item">
                  <ServiceButtons album={album} section="Купить" />
                </div>

                <div className="item">
                  <ServiceButtons album={album} section="Слушать" />
                </div>
              </div>

              <AlbumDetails album={album} />
            </>
          );
        }}
      </DataAwait>
    </section>
  );
}
