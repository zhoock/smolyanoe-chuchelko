import React from "react";
import { IAlbums } from "../../models";
import { DetalesProps } from "../../models";

/**
 * Компонент отображает блок с участниками и местами записи альбома.
 */
export default function AlbumDetailsMusic({ album }: { album: IAlbums }) {
  function Block({ title, content }: DetalesProps) {
    return (
      <>
        <h3>{title}</h3>
        <ul>
          {content.map((_) => (
            <li key={_}>{_}</li>
          ))}
        </ul>
      </>
    );
  }

  return album?.detales.map((_) => <Block {..._} key={_.id} />);
}
