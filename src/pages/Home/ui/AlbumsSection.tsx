import { DataAwait } from '@shared/DataAwait';
import { WrapperAlbumCover, AlbumCover } from '@entities/album';
import { Loader } from '@shared/ui/loader';
import { ErrorI18n } from '@shared/ui/error-message';
import type { AlbumsDeferred } from '@/routes/loaders/albumsLoader';

type AlbumsSectionProps = {
  data: AlbumsDeferred | null;
};

export function AlbumsSection({ data }: AlbumsSectionProps) {
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

        {data ? (
          <DataAwait
            value={data.templateA}
            fallback={<Loader />}
            error={<ErrorI18n code="albumsLoadFailed" />}
          >
            {(albums) => (
              <div className="albums__list">
                {albums.map((album) => (
                  <WrapperAlbumCover key={album.albumId} {...album} date={album.release.date}>
                    <AlbumCover {...album.cover} fullName={album.fullName} />
                  </WrapperAlbumCover>
                ))}
              </div>
            )}
          </DataAwait>
        ) : (
          <Loader />
        )}
      </div>
    </section>
  );
}
