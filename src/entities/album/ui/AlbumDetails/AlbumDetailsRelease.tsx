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

  // Функция для конвертации duration в минуты
  // duration может быть числом (секунды) или строкой (MM:SS или число-строка)
  const convertDurationToMinutes = (duration: number | string | undefined | null): number => {
    if (duration == null) return 0;

    // Если это число - это секунды, конвертируем в минуты
    if (typeof duration === 'number') {
      return duration / 60;
    }

    // Если это строка
    if (typeof duration === 'string') {
      // Проверяем формат MM:SS
      const mmssMatch = duration.match(/^(\d+):(\d{2})$/);
      if (mmssMatch) {
        const minutes = parseInt(mmssMatch[1], 10);
        const seconds = parseInt(mmssMatch[2], 10);
        return minutes + seconds / 60;
      }

      // Если это число в виде строки (секунды)
      const numDuration = parseFloat(duration);
      if (!isNaN(numDuration) && Number.isFinite(numDuration)) {
        return numDuration / 60;
      }
    }

    return 0;
  };

  // Суммируем длительность всех треков из БД (конвертируем секунды в минуты)
  const durationInMinutes: number =
    album?.tracks?.reduce((sum, track) => sum + convertDurationToMinutes(track.duration), 0) ?? 0;

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
              ? `${Math.round(durationInMinutes)} ${endForMinutes(Math.round(durationInMinutes))}`
              : `0 ${endForMinutes(0)}`}
          </small>
        </div>
      </>
    );
  }

  return <Block {...album?.release} />;
}
