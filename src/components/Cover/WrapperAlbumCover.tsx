import React from "react";
import { Link } from "react-router-dom";
import { AlbumsCoverProps } from "../../models";
import "./style.scss";

export default function WrapperAlbumCover({
  albumId,
  children,
  fullName,
  year,
}: AlbumsCoverProps) {
  return (
    <div className="b-covers-list__img">
      <Link to={`/albums/${albumId}`}>
        {children}
        <div className="b-covers-list__description">{fullName}</div>
        <div>{year?.slice(0, 4)}</div>
      </Link>
    </div>
  );
}
