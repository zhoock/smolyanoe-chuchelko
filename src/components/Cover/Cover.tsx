import React from "react";
import { String } from "../../models";
import { getImageUrl } from "../../hooks/albums";

/**
 * Компонент отображает обложку альбома.
 */
export default function Cover({ album, size }: any) {
  function Block({ webp, webp2x, jpg, jpg2x, img, albumId }: String) {
    return (
      <picture>
        <source
          srcSet={`${getImageUrl(webp, webp)} 1x, ${getImageUrl(webp2x, webp)} 2x`}
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

  return <Block {...album[0]} />;
}
