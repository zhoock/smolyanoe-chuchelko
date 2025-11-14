import { useEffect } from 'react';
import { DataAwait } from '@shared/DataAwait';
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
import type { AlbumsDeferred } from '@/routes/loaders/albumsLoader';

type AlbumsSectionProps = {
  data: AlbumsDeferred | null;
};

export function AlbumsSection({ data }: AlbumsSectionProps) {
  const dispatch = useAppDispatch();
  const { lang } = useLang();
  const status = useAppSelector((state) => selectAlbumsStatus(state, lang));
  const error = useAppSelector((state) => selectAlbumsError(state, lang));
  const albums = useAppSelector((state) => selectAlbumsData(state, lang));

  useEffect(() => {
    if (status === 'idle' || status === 'failed') {
      const promise = dispatch(fetchAlbums({ lang }));
      return () => {
        promise.abort();
      };
    }
  }, [dispatch, lang, status]);

  return (
    <section id="albums" className="albums main-background" aria-labelledby="home-albums-heading">
      <div className="wrapper">
        <h2 id="home-albums-heading">
          {data ? (
            <DataAwait value={data.templateC} fallback={<span>…</span>}>
              {(ui) => ui?.[0]?.titles?.albums}
            </DataAwait>
          ) : (
            <span>…</span>
          )}
        </h2>

        {status === 'loading' || status === 'idle' ? (
          <Loader />
        ) : status === 'failed' ? (
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
