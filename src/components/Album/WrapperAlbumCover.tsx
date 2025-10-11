// src/components/Album/WrapperAlbumCover.tsx
import { Link } from 'react-router-dom';
import { WrapperAlbumCoverProps } from '../../models';

import './style.scss';

export default function WrapperAlbumCover({
  albumId,
  date,
  album,
  children,
}: WrapperAlbumCoverProps) {
  return (
    <div className="albums__card">
      <Link to={`/albums/${albumId}`}>
        {children}
        <div className="albums__description">
          {album}

          <time dateTime={date}>
            <small>{date?.slice(0, 4)}</small>
          </time>
        </div>
      </Link>
    </div>
  );
}
