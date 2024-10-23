import React from "react";
import { IProduct } from "../../models";


/**
 * Компонент отображает блок с участниками и местами записи альбома.
 */
export default function AlbumDetailsMusic({ album }: { album: IProduct }) {
  function Block({ title, content }: { title: string; content: string[] }) {
    return (
      <>
        <h3>{title}</h3>
        <ul>{content?.map((_) => <li key={_}>{_}</li>)}</ul>
      </>
    );
  }

  return album?.detales.map((_: any) => <Block {..._} key={_.id} />);
}
