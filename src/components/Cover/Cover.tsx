import React from "react";
import { AlbumsProps } from "../../models";

import webp from "../../images/Tar-Baby-Cover-mobiles.webp";
import webp2x from "../../images/Tar-Baby-Cover-mobiles@2x.webp";
import jpg from "../../images/Tar-Baby-Cover-mobiles.jpg";
import jpg2x from "../../images/Tar-Baby-Cover-mobiles@2x.jpg";
import img from "../../images/Tar-Baby-Cover-mobiles.jpg";

import webp23 from "../../images/Tar-Baby-Cover-23-mobiles.webp";
import webp2x23 from "../../images/Tar-Baby-Cover-23-mobiles@2x.webp";
import jpg23 from "../../images/Tar-Baby-Cover-23-mobiles.jpg";
import jpg2x23 from "../../images/Tar-Baby-Cover-23-mobiles@2x.jpg";
import img23 from "../../images/Tar-Baby-Cover-23-mobiles.jpg";

/**
 * Компонент отображает обложку альбома.
 */
export default function Cover({ nameAlbum, size }: AlbumsProps) {
  if (nameAlbum == "Смоляное чучелко") {
    return (
      <picture>
        <source srcSet={`${webp} 1x, ${webp2x} 2x`} type="image/webp" />
        <source srcSet={`${jpg} 1x, ${jpg2x} 2x`} type="image/jpeg" />
        <img
          loading="lazy"
          src={img}
          alt={nameAlbum}
          width={size}
          height={size}
        />
      </picture>
    );
  }

  if (nameAlbum == "23") {
    return (
      <picture>
        <source srcSet={`${webp23} 1x, ${webp2x23} 2x`} type="image/webp" />
        <source srcSet={`${jpg23} 1x, ${jpg2x23} 2x`} type="image/jpeg" />
        <img
          loading="lazy"
          src={img23}
          alt={nameAlbum}
          width={size}
          height={size}
        />
      </picture>
    );
  }
}
