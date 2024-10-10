import React from "react";
import { ALBUMSDATA } from "../data";
import AlbumCover from "./AlbumCover";
import Cover from "./Cover";

/**
 * Компонент отображает блок с обложками альбомов.
 */
export default function CoverList({ handleCoverClick }: { handleCoverClick: any }) {
  return (
    <>
      <div className="row collapse medium-uncollapse">
        <div className="small-12 small-centered column">
          <div className="row medium-collapse">
            <div className="small-12 column">
              <h2>Альбомы</h2>
            </div>
          </div>
          <div className="b-cover-list">
            {ALBUMSDATA.map((album, i) => (
              <Cover
                key={i}
                handleCoverClick={handleCoverClick}
                nameAlbum={album.nameAlbum}
                fullName={album.fullName}
                year={album.release[0].date}
              >
                <AlbumCover
                  nameAlbum={album.nameAlbum}
                />
              </Cover>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
