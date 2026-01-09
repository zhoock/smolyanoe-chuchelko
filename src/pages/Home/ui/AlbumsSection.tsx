import { useState, useEffect, useMemo, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { WrapperAlbumCover, AlbumCover } from '@entities/album';
import { ErrorI18n } from '@shared/ui/error-message';
import { AlbumsSkeleton } from '@shared/ui/skeleton/AlbumsSkeleton';
import { useAppSelector } from '@shared/lib/hooks/useAppSelector';
import { useLang } from '@app/providers/lang';
import { selectAlbumsStatus, selectAlbumsError, selectAlbumsData } from '@entities/album';
import { selectUiDictionaryFirst } from '@shared/model/uiDictionary';
import { useProfileContext } from '@shared/context/ProfileContext';
import './AlbumsSection.scss';

// Адаптивное количество альбомов для отображения на главной
const getInitialCount = () => {
  if (typeof window === 'undefined') return 12;
  if (window.innerWidth >= 1024) return 16; // десктоп
  if (window.innerWidth >= 768) return 12; // планшет
  return 6; // мобильный (но там карусель, так что это не критично)
};

export function AlbumsSection() {
  const { lang } = useLang();
  const albumsStatus = useAppSelector((state) => selectAlbumsStatus(state, lang));
  const albumsError = useAppSelector((state) => selectAlbumsError(state, lang));
  const allAlbums = useAppSelector((state) => selectAlbumsData(state, lang));
  const ui = useAppSelector((state) => selectUiDictionaryFirst(state, lang));
  const { username } = useProfileContext();
  const basePath = useMemo(() => `/${username}`, [username]);
  const buildProfilePath = useCallback(
    (path: string = '') => {
      if (!path) {
        return basePath;
      }
      return `${basePath}${path.startsWith('/') ? path : `/${path}`}`;
    },
    [basePath]
  );

  const [initialCount, setInitialCount] = useState(getInitialCount);

  // Обновляем количество при изменении размера окна
  useEffect(() => {
    const handleResize = () => {
      setInitialCount(getInitialCount());
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const displayedAlbums = allAlbums.slice(0, initialCount);
  const hasMore = allAlbums.length > initialCount;

  // Данные загружаются через loader, не нужно загружать здесь

  // Не отображаем секцию, если загрузка завершена и альбомов нет
  if (
    albumsStatus !== 'loading' &&
    albumsStatus !== 'idle' &&
    !albumsError &&
    allAlbums.length === 0
  ) {
    return null;
  }

  return (
    <section id="albums" className="albums main-background" aria-labelledby="home-albums-heading">
      <div className="wrapper">
        <h2 id="home-albums-heading">{ui?.titles?.albums ?? '…'}</h2>

        {albumsStatus === 'loading' || albumsStatus === 'idle' ? (
          <AlbumsSkeleton count={initialCount} />
        ) : albumsStatus === 'failed' || albumsError ? (
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

            {hasMore && (
              <div className="albums__more">
                <Link to={buildProfilePath('/albums')} className="albums__more-button">
                  {ui?.buttons?.viewAllAlbums?.replace('{count}', String(allAlbums.length)) ??
                    `Все альбомы (${allAlbums.length})`}
                </Link>
              </div>
            )}
          </>
        )}
      </div>
    </section>
  );
}
