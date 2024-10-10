import React from "react";
import { AlbumsProps } from "../../models";

export default function Cover({
  handleCoverClick,
  nameAlbum,
  fullName,
  children,
  year,
}: AlbumsProps) {
  return (
    <div className="b-cover__img">
      {children}
      <h3 onClick={handleCoverClick}>{nameAlbum}</h3>
      <div className="b-cover__name-group">{fullName}</div>
      <div className="b-cover__name-album">{year!.slice(0, 4)}</div>
    </div>
  );
}
