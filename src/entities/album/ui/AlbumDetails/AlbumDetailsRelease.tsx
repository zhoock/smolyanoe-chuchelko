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

  // Суммируем длительность всех треков из БД (в минутах)
  const durationInMinutes: number =
    album?.tracks?.reduce((sum, track) => sum + (track.duration ?? 0), 0) ?? 0;

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
            {album?.tracks.length} {endForTracks(album?.tracks.length)},{' '}
            {Number.isFinite(durationInMinutes) && durationInMinutes > 0
              ? `${Math.ceil(durationInMinutes)} ${endForMinutes(Math.ceil(durationInMinutes))}`
              : `0 ${endForMinutes(0)}`}
          </small>
        </div>
      </>
    );
  }

  return <Block {...album?.release} />;
}
