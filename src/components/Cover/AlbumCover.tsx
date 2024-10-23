import React from "react";
import { String } from "../../models";
import { getImageUrl } from "../../hooks/albums";
import { IProduct } from "../../models";

type AlbumCoverProps<Size extends number = 896> = {
  album: IProduct;
  size?: Size;
};
/**
 * Компонент отображает обложку альбома.
 */
export default function AlbumCover({ album, size }: AlbumCoverProps) {
  function Block({ webp, webp2x, jpg, jpg2x, img, albumId }: String) {
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

  return album?.cover.map((_) => <Block {..._} key={_.id} />);
}
