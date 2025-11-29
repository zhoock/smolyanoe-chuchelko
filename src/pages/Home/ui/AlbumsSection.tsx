import { WrapperAlbumCover, AlbumCover } from '@entities/album';
import { ErrorI18n } from '@shared/ui/error-message';
import { AlbumsSkeleton } from '@shared/ui/skeleton/AlbumsSkeleton';
import { useAppSelector } from '@shared/lib/hooks/useAppSelector';
import { useLang } from '@app/providers/lang';
import { selectAlbumsStatus, selectAlbumsError, selectAlbumsData } from '@entities/album';
import { selectUiDictionaryFirst } from '@shared/model/uiDictionary';

export function AlbumsSection() {
  const { lang } = useLang();
  const albumsStatus = useAppSelector((state) => selectAlbumsStatus(state, lang));
  const albumsError = useAppSelector((state) => selectAlbumsError(state, lang));
  const albums = useAppSelector((state) => selectAlbumsData(state, lang));
  const ui = useAppSelector((state) => selectUiDictionaryFirst(state, lang));

  // Данные загружаются через loader, не нужно загружать здесь

  // TODO: ВРЕМЕННО для отладки - всегда показывать скелетон
  // Удалить этот блок после отладки
  return (
    <section id="albums" className="albums main-background" aria-labelledby="home-albums-heading">
      <div className="wrapper">
        <h2 id="home-albums-heading">{ui?.titles?.albums ?? '…'}</h2>
        <AlbumsSkeleton />
      </div>
    </section>
  );

  /*
  return (
    <section id="albums" className="albums main-background" aria-labelledby="home-albums-heading">
      <div className="wrapper">
        <h2 id="home-albums-heading">{ui?.titles?.albums ?? '…'}</h2>

        {albumsStatus === 'loading' || albumsStatus === 'idle' ? (
          <AlbumsSkeleton />
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
  */
}
