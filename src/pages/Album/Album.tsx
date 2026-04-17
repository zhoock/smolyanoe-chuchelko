// src/pages/Album/Album.tsx

import { useEffect, useMemo } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';

import { AlbumCover, AlbumDetails } from '@entities/album';
import { AlbumTracks } from '@widgets/albumTracks';
import { Share } from '@features/share';
import {
  ServiceButtons,
  hasAlbumPurchaseSectionContent,
  hasAlbumStreamSectionContent,
} from '@entities/service';
import { ErrorI18n } from '@shared/ui/error-message';
import { AlbumSkeleton } from '@shared/ui/skeleton';
import { useLang } from '@app/providers/lang';
import { useAppSelector } from '@shared/lib/hooks/useAppSelector';
import { selectAlbumsStatus, selectAlbumsError, selectAlbumByIdResolved } from '@entities/album';
import { getUser } from '@shared/lib/auth';
import { selectUiDictionaryFirst } from '@shared/model/uiDictionary';
import { useSiteArtistDisplayName } from '@shared/lib/hooks/useSiteArtistDisplayName';
import { formatAlbumDisplayFullName } from '@shared/lib/profileDisplayName';

export default function Album() {
  const { lang } = useLang();
  const location = useLocation();
  const artistParam = useMemo(() => {
    const params = new URLSearchParams(location.search);
    return params.get('artist');
  }, [location.search]);
  const { displayName: siteArtistName } = useSiteArtistDisplayName(lang, {
    artistSlug: artistParam,
  });
  const navigate = useNavigate();
  const { albumId = '' } = useParams<{ albumId: string }>();
  const albumsStatus = useAppSelector(selectAlbumsStatus);
  const albumsError = useAppSelector(selectAlbumsError);
  const album = useAppSelector((state) => selectAlbumByIdResolved(state, albumId));
  const ui = useAppSelector((state) => selectUiDictionaryFirst(state, lang));

  // 🔍 DEBUG: Логируем данные альбома для диагностики
  useEffect(() => {
    if (albumId === '23-remastered' && album) {
      console.log('[Album.tsx] 🔍 DEBUG 23-remastered:', {
        albumId: album.albumId,
        tracksCount: album.tracks?.length || 0,
        tracks: album.tracks?.map((t) => ({
          id: t.id,
          title: t.title,
        })),
      });
    }
  }, [album, albumId]);

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

  const albumsListLink = artistParam
    ? `/albums?artist=${encodeURIComponent(artistParam)}`
    : '/albums';

  useEffect(() => {
    // Smart fallback for direct URL without ?artist:
    // if album is not found in default context, resolve owner slug and redirect.
    if (!albumId || album || artistParam || albumsStatus !== 'succeeded') return;

    let isCancelled = false;

    const resolveOwnerAndRedirect = async () => {
      try {
        const response = await fetch(
          `/api/albums?resolveOwnerByAlbumId=true&albumId=${encodeURIComponent(albumId)}`
        );
        if (!response.ok) return;

        const result = await response.json();
        const artistSlug = result?.success ? result?.data?.artistSlug : null;
        if (!artistSlug || isCancelled) return;

        navigate(`/albums/${albumId}?artist=${encodeURIComponent(artistSlug)}`, { replace: true });
      } catch {
        // noop: keep standard "album not found" behavior if resolve fails
      }
    };

    void resolveOwnerAndRedirect();

    return () => {
      isCancelled = true;
    };
  }, [albumId, album, artistParam, albumsStatus, lang, navigate]);

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

  const viewerId = getUser()?.id ?? null;
  const isAlbumOwner = Boolean(album.userId && viewerId && album.userId === viewerId);
  const inArtistPublicContext = Boolean(artistParam?.trim());
  if (album.isPublic === false && !isAlbumOwner && !inArtistPublicContext) {
    return (
      <section className="album main-background" aria-label="Блок c альбомом">
        <div className="wrapper album__wrapper">
          <ErrorI18n code="albumNotFound" />
        </div>
      </section>
    );
  }

  // SEO (RU/EN) для конкретного альбома — имя из профиля, не albums.artist / album.fullName
  const seoTitle = formatAlbumDisplayFullName(siteArtistName, album.album);
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
                <Link to={albumsListLink}>{ui.titles.albums}</Link>
              </li>
            )}
          </ul>
        </nav>

        <div className="item">
          <AlbumCover
            img={album.cover || ''}
            userId={album.userId}
            fullName={formatAlbumDisplayFullName(siteArtistName, album.album)}
          />
          <Share />
        </div>

        <div className="item">
          <AlbumTracks album={album} />
        </div>

        {hasAlbumPurchaseSectionContent(album) && (
          <div className="item">
            <ServiceButtons album={album} section="Купить" />
          </div>
        )}

        {hasAlbumStreamSectionContent(album) && (
          <div className="item">
            <ServiceButtons album={album} section="Слушать" />
          </div>
        )}
      </div>

      <AlbumDetails album={album} />
    </section>
  );
}
