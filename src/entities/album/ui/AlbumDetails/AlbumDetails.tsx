import { useEffect } from 'react';
import AlbumDetailsRelease from './AlbumDetailsRelease';
import AlbumDetailsArtwork from './AlbumDetailsArtwork';
import AlbumDetailsMusic from './AlbumDetailsMusic';
import type { String, IAlbums } from '@models';
import { useLang } from '@app/providers/lang';
import { useAppDispatch } from '@shared/lib/hooks/useAppDispatch';
import { useAppSelector } from '@shared/lib/hooks/useAppSelector';
import {
  fetchUiDictionary,
  selectUiDictionaryStatus,
  selectUiDictionaryFirst,
} from '@shared/model/uiDictionary';
import './style.scss';

/**
 * Компонент отображает дополнительные данные об альбоме.
 */
export default function AlbumDetails({ album }: { album: IAlbums }) {
  const dispatch = useAppDispatch();
  const { lang } = useLang();
  const uiStatus = useAppSelector((state) => selectUiDictionaryStatus(state, lang));
  const ui = useAppSelector((state) => selectUiDictionaryFirst(state, lang));

  useEffect(() => {
    if (uiStatus === 'idle' || uiStatus === 'failed') {
      const promise = dispatch(fetchUiDictionary({ lang }));
      return () => {
        promise.abort();
      };
    }
  }, [dispatch, lang, uiStatus]);

  const titles = (ui?.titles as String | undefined) ?? {};
  const { music, release, albumCover } = titles;

  if (!music && !release && !albumCover) {
    return null;
  }

  return (
    <section className="album-details nested-background">
      <hr />
      <div className="wrapper album__wrapper">
        <div className="item">
          <div className="album-details__music">
            {music && <h2>{music}</h2>}
            <AlbumDetailsMusic album={album} />
          </div>
        </div>
        <div className="item item-release">
          <div className="album-details__released">
            {release && <h2>{release}</h2>}
            <AlbumDetailsRelease album={album} />
            <hr />
          </div>
          <div className="album-details__artwork">
            {albumCover && <h2>{albumCover}</h2>}
            <AlbumDetailsArtwork album={album} />
            <hr />
          </div>
        </div>
      </div>
    </section>
  );
}
