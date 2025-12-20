import type { IAlbums, detailsProps } from '@models';

/**
 * Компонент отображает блок с участниками и местами записи альбома.
 */
export default function AlbumDetailsMusic({ album }: { album: IAlbums }) {
  function Block({ title, content }: detailsProps) {
    const items = Array.isArray(content) ? content : []; // Проверяем, что content - массив

    // Определяем, является ли это блоком Genre/Жанр
    const isGenre =
      title === 'Genre' || title === 'Жанр' || title === 'Genres' || title === 'Жанры';

    // Для Genre объединяем все строковые элементы в одну строку через запятую
    if (isGenre) {
      const genreStrings = items
        .filter((item): item is string => typeof item === 'string')
        .map((genre) => {
          // Убираем существующие точки в конце, чтобы избежать двойных точек
          const cleanedGenre = genre.trim().replace(/\.+$/, '');

          // Форматируем: первое слово с заглавной, остальные слова в нижнем регистре
          return cleanedGenre
            .split(' ')
            .map((word, idx) => {
              if (idx === 0) {
                // Первое слово: первая буква заглавная, остальные в нижнем регистре
                return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
              } else {
                // Остальные слова: все в нижнем регистре
                return word.toLowerCase();
              }
            })
            .join(' ');
        });

      // Объединяем через запятую и пробел, добавляем одну точку в конце
      const genreText = genreStrings.length > 0 ? genreStrings.join(', ') + '.' : '';

      return (
        <>
          <h3>{title}</h3>
          <ul>{genreText && <li>{genreText}</li>}</ul>
        </>
      );
    }

    // Для остальных блоков - стандартная логика
    return (
      <>
        <h3>{title}</h3>
        <ul>
          {items.map((item, i) =>
            typeof item === 'string' ? (
              <li key={i}>{item}</li>
            ) : (
              <li key={i}>
                {item.text[0]}{' '}
                {
                  <a
                    className="album-details__link"
                    href={item.link}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {item.text[1]}
                  </a>
                }
                {item.text[2]}
              </li>
            )
          )}
        </ul>
      </>
    );
  }

  return Array.isArray(album?.details)
    ? album.details.map((d) => <Block {...d} key={d.id} />)
    : null;
}
