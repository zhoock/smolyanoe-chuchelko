import React from "react";

import { ALBUMSDATA } from "../data";
import WrapperCover from "../Cover/WrapperCover";
import Cover from "../Cover/Cover";

/**
 * Компонент отображает список альбомов в виде обложек-ссылок
 */
export default function Albums() {
  return (
    <section className="b-albums">
      <div className="row collapse medium-uncollapse">
        <div className="small-12 small-centered column">
          <div className="row medium-collapse">
            <div className="small-12 column">
              <h2>Альбомы</h2>
            </div>
          </div>
          <div className="b-cover-list">
            {ALBUMSDATA.map((album, i) => (
              <WrapperCover
                key={i}
                fullName={album.fullName}
                year={album.release[0].date}
                album={album}
              >
                <Cover nameAlbum={album.nameAlbum} />
              </WrapperCover>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
