import { useState, memo } from 'react';
import { getImageUrl } from 'hooks/data';
import type { CoverProps } from 'models';
import { useImageColor } from 'shared/lib/hooks/useImageColor';

/**
 * Компонент отображает обложку альбома.
 */
function AlbumCover({
  img,
  fullName,
  size = 448,
  onColorsExtracted, // Теперь этот коллбек принимает оба цвета
}: CoverProps & {
  onColorsExtracted?: (colors: { dominant: string; palette: string[] }) => void;
}) {
  const imgRef = useImageColor(img, onColorsExtracted); // Передаём, если есть
  const [isLoaded, setIsLoaded] = useState(false);

  return (
    <>
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
          ref={imgRef} // Теперь `useImageColor` точно получит изображение
          className="album-cover__image"
          loading="lazy"
          src={getImageUrl(img)}
          alt={`Обложка альбома ${fullName}`}
          onLoad={() => setIsLoaded(true)}
        />
      </picture>
    </>
  );
}

// Мемоизируем компонент, чтобы он не пересоздавался при смене трека
export default memo(AlbumCover, (prevProps, nextProps) => {
  // Компонент не должен пересоздаваться, если img и fullName не изменились
  // Для onColorsExtracted: если оба undefined или оба отсутствуют - считаем равными
  const prevCallback = prevProps.onColorsExtracted;
  const nextCallback = nextProps.onColorsExtracted;
  const callbacksEqual = prevCallback === nextCallback || (!prevCallback && !nextCallback);

  return (
    prevProps.img === nextProps.img &&
    prevProps.fullName === nextProps.fullName &&
    prevProps.size === nextProps.size &&
    callbacksEqual
  );
});
