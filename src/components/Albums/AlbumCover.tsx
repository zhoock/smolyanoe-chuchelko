import React from 'react';
import { getImageUrl } from '../../hooks/data';
import { CoverProps } from '../../models';

/**
 * Компонент отображает обложку альбома.
 */
export default function AlbumCover({
  img,
  fullName,
  size = 448, // default size for images
}: CoverProps) {
  return (
    <picture className="album-cover" role="img">
      <source
        className="album-cover__source"
        srcSet={`${getImageUrl(img, `-${size}.webp`)} 1x, ${getImageUrl(img, `@2x-${size * 2}.webp`)} 2x, ${getImageUrl(img, `@3x-${size * 3}.webp`)} 3x`}
        type="image/webp"
      />

      <source
        className="album-cover__source"
        srcSet={`${getImageUrl(img, `-${size}.jpg`)} 1x, ${getImageUrl(img, `@2x-${size * 2}.jpg`)} 2x`}
        type="image/jpeg"
      />

      <img
        className="album-cover__image"
        loading="lazy"
        src={getImageUrl(img)} // fallback для старых браузеров
        alt={`Обложка альбома ${fullName}`}
      />
    </picture>
  );
}
