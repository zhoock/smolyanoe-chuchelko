import React from "react";
import { AlbumsProps } from "../../models";
import { Link } from "react-router-dom";
import "./style.scss";

export default function WrapperCover({
  fullName,
  children,
  year,
  albumId,
}: AlbumsProps) {
  return (
    <div className="b-covers-list__img">
      <Link to={`/albums/${albumId}`}>
        {children}
        <div className="b-covers-list__description">{fullName}</div>
        <div>{year!.slice(0, 4)}</div>
      </Link>
    </div>
  );
}
