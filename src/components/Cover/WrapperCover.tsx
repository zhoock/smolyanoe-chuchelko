import React from "react";
import { AlbumsProps } from "../../models";
import { Link } from "react-router-dom";

export default function Cover({
  fullName,
  children,
  year,
  album,
}: AlbumsProps) {
  return (
    <div className="b-cover__img">
      <Link to={`/albums/${album.albumId}`}>
        {children}
        <div className="b-cover__name-group">{fullName}</div>
        <div className="b-cover__name-album">{year!.slice(0, 4)}</div>
      </Link>
    </div>
  );
}
