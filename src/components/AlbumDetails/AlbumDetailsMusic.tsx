import React from 'react';
import { IAlbums } from '../../models';
import { DetalesProps } from '../../models';
import { ALBUMSDATA } from '../Data/Data';

/**
 * Компонент отображает блок с участниками и местами записи альбома.
 */
export default function AlbumDetailsMusic({ album }: { album: IAlbums }) {
  function Block({ title, content }: DetalesProps) {
    return (
      <>
        <h3>{title}</h3>
        <ul>
          {content.map((item: any) =>
            typeof item === 'string' ? (
              <li key={item}>{item}</li>
            ) : (
              <li key={item}>
                {
                  <a href={item.link} target="_blank">
                    {item.text}
                  </a>
                }
              </li>
            ),
          )}
        </ul>
      </>
    );
  }

  return album?.detales.map((_) => <Block {..._} key={_.id} />);
}
