import React from "react";
import { getImageUrl } from "../../hooks/albums";
import { CoverProps } from "../../models";

/**
 * Компонент отображает обложку альбома.
 */
export default function AlbumCover({
  webp,
  webp2x,
  jpg,
  jpg2x,
  img,
  albumId,
  size,
}: CoverProps) {
  return (
    <picture>
      <source
        srcSet={`${getImageUrl(webp, ".webp")} 1x, ${getImageUrl(webp2x, ".webp")} 2x`}
        type="image/webp"
      />
      <source
        srcSet={`${getImageUrl(jpg)} 1x, ${getImageUrl(jpg2x)} 2x`}
        type="image/jpeg"
      />
      <img
        loading="lazy"
        src={getImageUrl(img)}
        alt={albumId}
        width={size}
        height={size}
      />
    </picture>
  );
}
