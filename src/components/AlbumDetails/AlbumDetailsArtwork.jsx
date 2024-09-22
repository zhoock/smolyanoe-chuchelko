import { release } from "../data";

/**
 * Компонент отображает блок с информацией об обложке альбома.
 * @component
 * @param {string} nameAlbum - Название альбома.
 */
export default function AlbumDetailsArtwork({ nameAlbum }) {
  /**
   * Функция отображает блок с информацией об обложке альбома.
   * @component
   * @param {Object[]} release - Данные по выбранному альбому.
   * @param {string} release[].photo - Фотография обложки.
   * @param {string} release[].photographer - Фотограф обложки.
   * @param {string} release[].design - Дизайн обложки.
   * @param {string} release[].designer - Дизайнер обложки.
   */
  function Block({
    photographer,
    photographerURL,
    design,
    designer,
    designerURL,
  }) {
    return (
      <>
        {photographer && <h3>Фотография</h3>}
        {photographer && (
          <p>
            <a href={photographerURL}>{photographer}</a>
          </p>
        )}
        <h3>{design}</h3>
        <p>{designerURL ? <a href={designerURL}>{designer}</a> : designer}</p>
      </>
    );
  }

  return <Block {...release(nameAlbum)} />;
}
