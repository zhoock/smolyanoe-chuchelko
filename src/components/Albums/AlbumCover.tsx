import React from 'react';
import { getImageUrl } from '../../hooks/data';
import { CoverProps } from '../../models';

/**
 * Компонент отображает обложку альбома.
 */
export default function AlbumCover({
  webp,
  webp2x,
  webp3x,
  jpg,
  jpg2x,
  img,
  fullName,
  size = 896,
}: CoverProps) {
  return (
    <picture className="album-cover" role="img">
      {/* AVIF – самое эффективное сжатие, загружается первым, если поддерживается */}
      {/* <source
        className="album-cover__source"
        srcSet={`${getImageUrl(avif, '-448.avif')} 1x, ${getImageUrl(avif2x, '-896.avif')} 2x, ${getImageUrl(avif3x, '-1344.avif')} 3x`}
        type="image/avif"
      /> */}

      {/* WebP – современный, но чуть хуже сжатие, fallback для AVIF */}
      <source
        className="album-cover__source"
        srcSet={`${getImageUrl(webp, '-448.webp')} 1x, ${getImageUrl(webp2x, '-896.webp')} 2x, ${getImageUrl(webp3x, '-1344.webp')} 3x`}
        type="image/webp"
      />

      {/* JPEG – fallback для старых браузеров */}
      <source
        className="album-cover__source"
        // srcSet={`${getImageUrl(jpg, '-448.jpg')} 1x, ${getImageUrl(jpg2x, '-896.jpg')} 2x, ${getImageUrl(jpg3x, '-1344.jpg')} 3x`}
        srcSet={`${getImageUrl(jpg, '-448.jpg')} 1x, ${getImageUrl(jpg2x, '-896.jpg')} 2x`}
        type="image/jpeg"
      />

      {/* Самый универсальный вариант для браузеров без поддержки <source> */}
      <img
        className="album-cover__image"
        loading="lazy"
        src={getImageUrl(jpg, '-600.jpg')}
        alt={`обложка альбома ${fullName}`}
        width={size}
        height={size}
      />
    </picture>
  );
}
