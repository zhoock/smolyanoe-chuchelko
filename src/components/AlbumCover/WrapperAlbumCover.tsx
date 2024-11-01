import React from "react";
import { Link } from "react-router-dom";
import { WrapperAlbumCoverProps } from "../../models";
import "./style.scss";

export default function WrapperAlbumCover({
  albumId,
  date,
  fullName,
  children,
}: WrapperAlbumCoverProps) {
  return (
    <div className="albums__list-item">
      <Link to={`/albums/${albumId}`}>
        {children}
        <div className="albums__description">
          {fullName}
          <div className="albums__description-year">
            {date?.slice(0, 4)}
          </div>
        </div>
      </Link>
    </div>
  );
}
