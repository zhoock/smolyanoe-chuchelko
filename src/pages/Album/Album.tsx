// src/pages/Album/Album.tsx

import { useEffect, useMemo } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';

import { AlbumCover, AlbumDetails } from '@entities/album';
import { AlbumTracks } from '@widgets/albumTracks';
import { Share } from '@features/share';
import { ServiceButtons } from '@entities/service';
import { ErrorI18n } from '@shared/ui/error-message';
import { AlbumSkeleton } from '@shared/ui/skeleton';
import { useLang } from '@app/providers/lang';
import { useAppSelector } from '@shared/lib/hooks/useAppSelector';
import { selectAlbumsStatus, selectAlbumsError, selectAlbumById } from '@entities/album';
import { selectUiDictionaryFirst } from '@shared/model/uiDictionary';

export default function Album() {
  const { lang } = useLang();
  const { albumId = '' } = useParams<{ albumId: string }>();
  const albumsStatus = useAppSelector((state) => selectAlbumsStatus(state, lang));
  const albumsError = useAppSelector((state) => selectAlbumsError(state, lang));
  const album = useAppSelector((state) => selectAlbumById(state, lang, albumId));
  const ui = useAppSelector((state) => selectUiDictionaryFirst(state, lang));

  // Определяем, пришли ли мы со страницы списка альбомов
  const cameFromAlbumsPage = useMemo(() => {
    if (typeof window === 'undefined') return false;

    // Проверяем sessionStorage для предыдущего пути (работает при клиентской навигации)
    const previousPath = sessionStorage.getItem('previousPath');
    if (previousPath) {
      // Проверяем, что предыдущий путь - это страница списка альбомов
      return previousPath === '/albums' || previousPath === '/en/albums';
    }

    // Fallback: проверяем document.referrer (работает при полной перезагрузке страницы)
    const referrer = document.referrer;
    if (!referrer) return false;

    try {
      const origin = window.location.origin;
      const referrerUrl = new URL(referrer);

      if (referrerUrl.origin !== origin) return false;

      const pathname = referrerUrl.pathname;
      return pathname === '/albums' || pathname === '/en/albums';
    } catch {
      return false;
    }
  }, []);

  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [albumId]);

  // Данные загружаются через loader

  if (albumsStatus === 'loading' || albumsStatus === 'idle') {
    return <AlbumSkeleton />;
  }

  if (albumsStatus === 'failed') {
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
            {ui?.links?.home && (
              <li>
                <Link to="/">{ui.links.home}</Link>
              </li>
            )}
            {/* Показываем "Все альбомы" только если пришли со страницы списка */}
            {cameFromAlbumsPage && ui?.titles?.albums && (
              <li>
                <Link to="/albums">{ui.titles.albums}</Link>
              </li>
            )}
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
