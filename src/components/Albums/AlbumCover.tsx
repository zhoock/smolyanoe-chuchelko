import React from 'react';
import { getImageUrl } from '../../hooks/data';
import { CoverProps } from '../../models';

/**
 * Компонент отображает обложку альбома.
 */
export default function AlbumCover({
  webp,
  webp2x,
  jpg,
  jpg2x,
  img,
  fullName,
  size,
}: CoverProps) {
  return (
    // TODO: заменить изображения на более крупные, когда они придут из дизайна

    <picture>
      <source
        srcSet={`${getImageUrl(webp, '.webp')} 1x, ${getImageUrl(webp2x, '.webp')} 2x`}
        type="image/webp"
      />
      <source
        srcSet={`${getImageUrl(jpg)} 1x, ${getImageUrl(jpg2x)} 2x`}
        type="image/jpeg"
      />

      <img
        loading="lazy"
        src={getImageUrl(img)}
        alt={`обложка альбома ${fullName}`}
        width={size}
        height={size}
      />
    </picture>
  );
}
