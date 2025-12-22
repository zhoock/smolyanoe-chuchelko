import { useLang } from '@app/providers/lang';
import { buildRecordingText } from '@pages/UserDashboard/components/EditAlbumModal.utils';
import type { IAlbums, detailsProps } from '@models';

/**
 * Компонент отображает блок с участниками и местами записи альбома.
 */
export default function AlbumDetailsMusic({ album }: { album: IAlbums }) {
  const { lang } = useLang() as { lang: 'en' | 'ru' };

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

    // Проверяем, является ли это блоком Recorded At, Mixed At или Mastered By
    const isRecordingBlock =
      title === 'Recorded At' ||
      title === 'Запись' ||
      title === 'Mixed At' ||
      title === 'Сведение' ||
      title === 'Mastered By' ||
      title === 'Мастеринг';

    // Для остальных блоков - стандартная логика
    return (
      <>
        <h3>{title}</h3>
        <ul>
          {items.map((item, i) => {
            // Новый формат: { dateFrom, dateTo?, studioText, url }
            if (
              typeof item === 'object' &&
              item !== null &&
              'dateFrom' in item &&
              !('text' in item)
            ) {
              const recordingItem = item as {
                dateFrom: string;
                dateTo?: string;
                studioText?: string;
                url?: string | null;
              };

              const displayText = buildRecordingText(
                recordingItem.dateFrom,
                recordingItem.dateTo,
                recordingItem.studioText,
                lang
              );

              if (recordingItem.url) {
                return (
                  <li key={i}>
                    <a
                      className="album-details__link"
                      href={recordingItem.url}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      {displayText}
                    </a>
                  </li>
                );
              }

              return <li key={i}>{displayText}</li>;
            }

            // Старый формат для других блоков: строка или { text: [], link }
            if (typeof item === 'string') {
              return <li key={i}>{item}</li>;
            }

            // Старый формат с text и link
            if (typeof item === 'object' && item !== null && 'text' in item && 'link' in item) {
              const oldItem = item as { text: string[]; link: string };
              return (
                <li key={i}>
                  {oldItem.text[0]}{' '}
                  {
                    <a
                      className="album-details__link"
                      href={oldItem.link}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      {oldItem.text[1]}
                    </a>
                  }
                  {oldItem.text[2]}
                </li>
              );
            }

            return null;
          })}
        </ul>
      </>
    );
  }

  return Array.isArray(album?.details)
    ? album.details.map((d) => <Block {...d} key={d.id} />)
    : null;
}
