import type { IAlbums, String } from '@models';
import { formatDate } from '@shared/api/albums';
import { useLang } from '@app/providers/lang';
import { functionsMap } from './Functions'; // Импортируем функции

/**
 * Компонент отображает блок с датой релиза альбома.
 */
export default function AlbumDetailsReleased({ album }: { album: IAlbums }) {
  const { lang } = useLang() as { lang: keyof typeof functionsMap };
  // Подгружаем функции для выбранного языка
  const { endForTracks, endForMinutes } = functionsMap[lang];

  const duration: number = album?.tracks
    .map((item) => item.duration)
    .reduce((sum, current) => sum + current);

  function Block({ date, UPC }: String) {
    return (
      <>
        <time className="album-details__released-time" dateTime={date}>
          {formatDate(date)}
        </time>
        <div>
          <small>UPC: {UPC}</small>
        </div>
        <div>
          <small>
            {album?.tracks.length} {endForTracks(album?.tracks.length)}, {Math.ceil(duration)}{' '}
            {endForMinutes(duration)}
          </small>
        </div>
      </>
    );
  }

  return <Block {...album?.release} />;
}
