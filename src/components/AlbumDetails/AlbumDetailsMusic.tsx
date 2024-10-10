import React from "react";
import { detales } from "../data";
import { AlbumsProps } from "../../models";

/**
 * Компонент отображает блок с участниками и местами записи альбома.
 */
export default function AlbumDetailsMusic({ nameAlbum }: AlbumsProps) {
  function Block({ title, content }: { title: string; content: string[] }) {
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

  return detales(nameAlbum).map((_) => <Block {..._} key={_.id} />);
}
