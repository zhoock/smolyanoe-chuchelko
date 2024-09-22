import { release } from "../data";
import { tracks } from "../data";

/**
 * Функция возвращает дату релиза альбома в формате дд.мм.гг.
 * @param {Object} object
 * @param {string} object.template - Шаблон даты релиза альбома.
 * @param {string} object.dateRelease - Дата релиза альбома.
 * @returns {string} — Строка в формате 23/01/2022
 */
function formatDate(dateRelease) {
  const date = new Date(dateRelease);

  let dd = date.getDate();
  if (dd < 10) dd = "0" + dd;

  let mm = date.getMonth() + 1;
  if (mm < 10) mm = "0" + mm;

  let yy = date.getFullYear();
  if (yy < 10) yy = "0" + yy;

  return `${dd}/${mm}/${yy}`;
}

/**
 * Функция возвращает строку с верным падежным окончанием.
 * @param {number} n - Количество треков.
 * @returns {string}
 */
function endForTracks(n) {
  return n > 2 && n < 4 ? "песни" : n > 4 ? "песен" : "песня";
}

/**
 * Функция возвращает строку с верным падежным окончанием.
 * @param {number} n - Количество минут.
 * @returns {string}
 */
function endForMinutes(n) {
  return n > 2 && n < 4 ? "минуты" : n > 4 ? "минут" : "минута";
}

/**
 * Компонент отображает блок с датой релиза альбома.
 *
 * @component
 * @param {string} nameAlbum - Название альбома.
 * @param {Object[]} release — Данные по выбранному альбому.
 * @param {string} date - Дата релиза альбома.
 */
export default function AlbumDetailsReleased({ nameAlbum }) {
  const duration = tracks(nameAlbum)
    .map((item) => item.duration)
    .reduce((sum, current) => sum + current);

  // деструктуризация
  function Block({ date, UPC }) {
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
  }

  // оператор расширения или распространения (spread-оператор) ...
  return <Block {...release(nameAlbum)} />;
}
