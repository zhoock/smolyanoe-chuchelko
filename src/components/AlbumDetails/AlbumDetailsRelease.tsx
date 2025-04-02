import React from 'react';
import { IAlbums, String } from '../../models';
import { formatDate } from '../../hooks/data';

/**
 * Функция возвращает строку (количество треков) с верным падежным окончанием.
 */
// const endForTracks = (n: number): 'песни' | 'песен' | 'песня' =>
//   n > 2 && n < 4 ? 'песни' : n > 4 ? 'песен' : 'песня';

// const endForTracks = (n: number): string => (n === 1 ? 'track' : 'tracks');

/**
 * Функция возвращает строку (количество минут) с верным падежным окончанием.
 */
// const endForMinutes = (n: number): 'минуты' | 'минут' | 'минута' =>
//   n > 2 && n < 4 ? 'минуты' : n > 4 ? 'минут' : 'минута';

const endForMinutes = (n: number): string => (n === 1 ? 'minute' : 'minutes');

/**
 * Компонент отображает блок с датой релиза альбома.
 */
export default function AlbumDetailsReleased({ album }: { album: IAlbums }) {
  let endForTracks = new Function(album?.release.fn);

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
            {album?.tracks.length} {endForTracks(album?.tracks.length)},{' '}
            {Math.ceil(duration)} {endForMinutes(duration)}
          </small>
        </div>
      </>
    );
  }

  return <Block {...album?.release} />;
}
