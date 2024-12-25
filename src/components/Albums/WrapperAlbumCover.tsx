import React from "react";
import { Link } from "react-router-dom";
import { WrapperAlbumCoverProps } from "../../models";
import "./style.scss";

export default function WrapperAlbumCover({
  albumId,
  date,
  nameAlbum,
  children,
}: WrapperAlbumCoverProps) {
  return (
    <div className="albums__list-item">
      <Link to={`/albums/${albumId}`}>
        {children}
        <div className="albums__description">
          {nameAlbum}
          <div className="albums__description-year">
            <time dateTime={date}>
              <small>{date?.slice(0, 4)}</small>
            </time>
          </div>
        </div>
      </Link>
    </div>
  );
}
