import { useEffect } from 'react';
import { WrapperAlbumCover, AlbumCover } from '@entities/album';
import { Loader } from '@shared/ui/loader';
import { ErrorI18n } from '@shared/ui/error-message';
import { useAppDispatch } from '@shared/lib/hooks/useAppDispatch';
import { useAppSelector } from '@shared/lib/hooks/useAppSelector';
import { useLang } from '@app/providers/lang';
import {
  fetchAlbums,
  selectAlbumsStatus,
  selectAlbumsError,
  selectAlbumsData,
} from '@entities/album';
import {
  fetchUiDictionary,
  selectUiDictionaryStatus,
  selectUiDictionaryFirst,
} from '@shared/model/uiDictionary';

export function AlbumsSection() {
  const dispatch = useAppDispatch();
  const { lang } = useLang();
  const albumsStatus = useAppSelector((state) => selectAlbumsStatus(state, lang));
  const albumsError = useAppSelector((state) => selectAlbumsError(state, lang));
  const albums = useAppSelector((state) => selectAlbumsData(state, lang));
  const uiStatus = useAppSelector((state) => selectUiDictionaryStatus(state, lang));
  const ui = useAppSelector((state) => selectUiDictionaryFirst(state, lang));

  useEffect(() => {
    if (albumsStatus === 'idle' || albumsStatus === 'failed') {
      const promise = dispatch(fetchAlbums({ lang }));
      return () => {
        promise.abort();
      };
    }
  }, [dispatch, lang, albumsStatus]);

  useEffect(() => {
    if (uiStatus === 'idle' || uiStatus === 'failed') {
      const promise = dispatch(fetchUiDictionary({ lang }));
      return () => {
        promise.abort();
      };
    }
  }, [dispatch, lang, uiStatus]);

  return (
    <section id="albums" className="albums main-background" aria-labelledby="home-albums-heading">
      <div className="wrapper">
        <h2 id="home-albums-heading">{ui?.titles?.albums ?? '…'}</h2>

        {albumsStatus === 'loading' || albumsStatus === 'idle' ? (
          <Loader />
        ) : albumsStatus === 'failed' ? (
          <ErrorI18n code="albumsLoadFailed" />
        ) : (
          <div className="albums__list">
            {albums.map((album) => (
              <WrapperAlbumCover key={album.albumId} {...album} date={album.release.date}>
                <AlbumCover {...album.cover} fullName={album.fullName} />
              </WrapperAlbumCover>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
