import React from "react";
import { release } from "../data";
import { tracks } from "../data";
import { AlbumsProps } from "../../models";
import { String } from "../../models";
;

/**
 * Функция возвращает дату релиза альбома в формате дд/мм/гг.
 */
const formatDate = (dateRelease: string) => {
  const date = new Date(dateRelease);

  let dd: number | string = date.getDate();
  if (dd < 10) dd = "0" + dd;

  let mm: number | string = date.getMonth() + 1;
  if (mm < 10) mm = "0" + mm;

  let yy: number | string = date.getFullYear();
  if (yy < 10) yy = "0" + yy;

  return `${dd}/${mm}/${yy}`;
};

/**
 * Функция возвращает строку (количество треков) с верным падежным окончанием.
 */
const endForTracks = (n: number) =>
  n > 2 && n < 4 ? "песни" : n > 4 ? "песен" : "песня";

/**
 * Функция возвращает строку (количество минут) с верным падежным окончанием.
 */
const endForMinutes = (n: number) =>
  n > 2 && n < 4 ? "минуты" : n > 4 ? "минут" : "минута";

/**
 * Компонент отображает блок с датой релиза альбома.
 */
const AlbumDetailsReleased = ({ nameAlbum }: AlbumsProps) => {
  const duration = tracks(nameAlbum)
    .map((item) => item.duration)
    .reduce((sum, current) => sum + current);

  // деструктуризация
  const Block = ({ date, UPC }: String) => {
    return (
      <>
        <time dateTime={date}>{formatDate(date)}</time>
        <div>
          <small>UPC: {UPC}</small>
        </div>
        <div>
          <small>
            {tracks(nameAlbum).length} {endForTracks(tracks(nameAlbum).length)},{" "}
            {Math.ceil(duration)} {endForMinutes(duration)}
          </small>
        </div>
      </>
    );
  };

  // оператор расширения или распространения (spread-оператор) ...
  return <Block {...release(nameAlbum)} />;
};

export default AlbumDetailsReleased;
