// src/pages/Album/Album.tsx

import { useEffect } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';

import { AlbumCover, AlbumDetails } from '@entities/album';
import { AlbumTracks } from '@widgets/albumTracks';
import { Share } from '@features/share';
import { ServiceButtons } from '@entities/service';
import { ErrorI18n } from '@shared/ui/error-message';
import { useAlbumsData } from '@shared/api/albums';
import { DataAwait } from '@shared/DataAwait';
import { Loader } from '@shared/ui/loader';
import { useLang } from '@app/providers/lang';
import { useAppDispatch } from '@shared/lib/hooks/useAppDispatch';
import { useAppSelector } from '@shared/lib/hooks/useAppSelector';
import {
  fetchAlbums,
  selectAlbumsStatus,
  selectAlbumsError,
  selectAlbumById,
} from '@entities/album';

export default function Album() {
  const dispatch = useAppDispatch();
  const { lang } = useLang();
  const data = useAlbumsData(lang);
  const { albumId = '' } = useParams<{ albumId: string }>();
  const status = useAppSelector((state) => selectAlbumsStatus(state, lang));
  const error = useAppSelector((state) => selectAlbumsError(state, lang));
  const album = useAppSelector((state) => selectAlbumById(state, lang, albumId));

  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [albumId]);

  useEffect(() => {
    if (!albumId) {
      return;
    }

    if (status === 'idle' || status === 'failed') {
      const promise = dispatch(fetchAlbums({ lang }));
      return () => {
        promise.abort();
      };
    }
  }, [dispatch, lang, status, albumId]);

  if (!data) {
    return (
      <section className="album main-background" aria-label="Блок c альбомом">
        <div className="wrapper album__wrapper">
          <Loader />
        </div>
      </section>
    );
  }

  if (status === 'loading' || status === 'idle') {
    return (
      <section className="album main-background" aria-label="Блок c альбомом">
        <div className="wrapper album__wrapper">
          <Loader />
        </div>
      </section>
    );
  }

  if (status === 'failed') {
    return (
      <section className="album main-background" aria-label="Блок c альбомом">
        <div className="wrapper album__wrapper">
          <ErrorI18n code="albumLoadFailed" />
        </div>
      </section>
    );
  }

  if (!album) {
    return (
      <section className="album main-background" aria-label="Блок c альбомом">
        <div className="wrapper album__wrapper">
          <ErrorI18n code="albumNotFound" />
        </div>
      </section>
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
    <section className="album main-background" aria-label="Блок c альбомом">
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
              <DataAwait value={data.templateC} fallback={null} error={null}>
                {(ui) => {
                  const homeLabel = ui?.[0]?.links?.home;
                  return homeLabel ? <Link to="/">{homeLabel}</Link> : null;
                }}
              </DataAwait>
            </li>
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
    </section>
  );
}
