import React from 'react';
import { IAlbums, DetalesProps } from '../../models';

/**
 * Компонент отображает блок с участниками и местами записи альбома.
 */
export default function AlbumDetailsMusic({ album }: { album: IAlbums }) {
  function Block({ title, content }: DetalesProps) {
    return (
      <>
        <h3>{title}</h3>
        <ul>
          {content.map((_: any) =>
            typeof _ === 'string' ? (
              <li key={_}>{_}</li>
            ) : (
              <li key={_}>
                {_.text[0]}{' '}
                {
                  <a
                    className="album-details__link"
                    href={_.link}
                    target="_blank"
                  >
                    {_.text[1]}
                  </a>
                }
                {_.text[2]}
              </li>
            ),
          )}
        </ul>
      </>
    );
  }

  return album?.detales.map((_) => <Block {..._} key={_.id} />);
}
