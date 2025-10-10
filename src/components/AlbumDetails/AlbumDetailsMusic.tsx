// src/components/AlbumDetails/AlbumDetailsMusic.tsx
import { IAlbums, detailsProps } from '../../models';

/**
 * Компонент отображает блок с участниками и местами записи альбома.
 */
export default function AlbumDetailsMusic({ album }: { album: IAlbums }) {
  function Block({ title, content }: detailsProps) {
    return (
      <>
        <h3>{title}</h3>
        <ul>
          {content.map((item, i) =>
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

  return album?.details.map((detail) => <Block {...detail} key={detail.id} />);
}
