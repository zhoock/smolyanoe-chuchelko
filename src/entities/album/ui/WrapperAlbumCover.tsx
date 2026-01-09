// src/entities/album/ui/WrapperAlbumCover.tsx
import { Link } from 'react-router-dom';
import { useProfileContext } from '@shared/context/ProfileContext';
import type { WrapperAlbumCoverProps } from 'models';

import './style.scss';

export default function WrapperAlbumCover({
  albumId,
  date,
  album,
  children,
}: WrapperAlbumCoverProps) {
  const { username } = useProfileContext();
  const albumHref = `/${username}/albums/${albumId}`;

  return (
    <div className="albums__card">
      <Link to={albumHref}>
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
