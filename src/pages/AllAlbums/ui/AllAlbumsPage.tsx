// src/pages/AllAlbums/ui/AllAlbumsPage.tsx

import { useEffect, useState, useRef } from 'react';
import { Link } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { WrapperAlbumCover, AlbumCover } from '@entities/album';
import { ErrorI18n } from '@shared/ui/error-message';
import { AlbumsSkeleton } from '@shared/ui/skeleton/AlbumsSkeleton';
import { useAppSelector } from '@shared/lib/hooks/useAppSelector';
import { useLang } from '@app/providers/lang';
import { selectAlbumsStatus, selectAlbumsData } from '@entities/album';
import { selectUiDictionaryFirst } from '@shared/model/uiDictionary';
import '@entities/album/ui/style.scss';
import './style.scss';

// Количество альбомов для подгрузки за раз
const BATCH_SIZE = 16;

export function AllAlbumsPage() {
  const { lang } = useLang();
  const albumsStatus = useAppSelector((state) => selectAlbumsStatus(state, lang));
  const allAlbums = useAppSelector((state) => selectAlbumsData(state, lang));
  const ui = useAppSelector((state) => selectUiDictionaryFirst(state, lang));

  const [displayedCount, setDisplayedCount] = useState(BATCH_SIZE);
  const observerRef = useRef<IntersectionObserver | null>(null);
  const loadMoreRef = useRef<HTMLDivElement | null>(null);

  // Сбрасываем счетчик при смене языка или данных
  useEffect(() => {
    setDisplayedCount(BATCH_SIZE);
  }, [lang, allAlbums.length]);

  // Infinite scroll с Intersection Observer
  useEffect(() => {
    if (albumsStatus !== 'succeeded' || displayedCount >= allAlbums.length) {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          setDisplayedCount((prev) => Math.min(prev + BATCH_SIZE, allAlbums.length));
        }
      },
      {
        rootMargin: '200px', // Начинаем загрузку за 200px до конца
      }
    );

    if (loadMoreRef.current) {
      observer.observe(loadMoreRef.current);
    }

    observerRef.current = observer;

    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect();
      }
    };
  }, [albumsStatus, displayedCount, allAlbums.length]);

  const displayedAlbums = allAlbums.slice(0, displayedCount);
  const hasMore = displayedCount < allAlbums.length;

  // SEO
  const seoTitle = ui?.titles?.allAlbumsPageTitle ?? '';
  const seoDesc = ui?.titles?.allAlbumsPageDesc ?? '';

  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, []);

  return (
    <section className="all-albums main-background" aria-label={seoTitle}>
      <Helmet>
        <title>{seoTitle}</title>
        <meta name="description" content={seoDesc} />
      </Helmet>

      <div className="wrapper">
        <nav className="breadcrumb item-type-a" aria-label="Breadcrumb">
          <ul>
            <li>{ui?.links?.home ? <Link to="/">{ui.links.home}</Link> : null}</li>
          </ul>
        </nav>

        <h2>{ui?.titles?.albums ?? seoTitle}</h2>

        {albumsStatus === 'loading' || albumsStatus === 'idle' ? (
          <AlbumsSkeleton count={BATCH_SIZE} />
        ) : albumsStatus === 'failed' ? (
          <ErrorI18n code="albumsLoadFailed" />
        ) : (
          <>
            <div className="albums__list">
              {displayedAlbums.map((album) => (
                <WrapperAlbumCover key={album.albumId} {...album} date={album.release.date}>
                  <AlbumCover
                    img={album.cover || ''}
                    fullName={album.fullName}
                    userId={album.userId || undefined}
                  />
                </WrapperAlbumCover>
              ))}
            </div>

            {/* Элемент для отслеживания скролла */}
            {hasMore && (
              <div ref={loadMoreRef} className="all-albums__load-more" aria-hidden="true">
                <AlbumsSkeleton count={4} />
              </div>
            )}

            {/* Индикатор конца списка */}
            {!hasMore && allAlbums.length > 0 && (
              <p className="all-albums__end">{ui?.buttons?.allAlbumsLoaded ?? ''}</p>
            )}
          </>
        )}
      </div>
    </section>
  );
}

export default AllAlbumsPage;
