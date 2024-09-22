import { detales } from "../data";

/**
 * Компонент отображает блок с участниками и местами записи альбома.
 * @component
 * @param {string} nameAlbum - Название альбома.
 * @param {Object[]} detales - Данные по выбранному альбому.
 * @param {number} detales[].id - Идентификатор блока.
 * @param {string} detales[].title - Заголовок блока.
 * @param {Object[]} content - Текст блока.
 */
export default function AlbumDetailsMusic({ nameAlbum }) {
  function Block({ title, content }) {
    return (
      <>
        <h3>{title}</h3>
        <ul>
          {content.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </>
    );
  }

  // console.log(JSON.stringify(detales(nameAlbum))); // получаем массив объектов

  return detales(nameAlbum).map((detales) => (
    <Block {...detales} key={detales.id} />
  ));
}
