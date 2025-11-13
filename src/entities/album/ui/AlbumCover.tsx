// src/entities/album/ui/AlbumCover.tsx
import { memo, useMemo } from 'react';
import { getImageUrl } from '@shared/api/albums';
import type { CoverProps } from 'models';
import { useImageColor } from '@shared/lib/hooks/useImageColor';

type ImageFormat = 'webp' | 'jpg';
type Density = 1 | 2 | 3;

const DEFAULT_BASE_SIZE = 448;
const DEFAULT_DENSITIES: Density[] = [1, 2, 3];

const DENSITY_SUFFIX: Record<ImageFormat, Record<Density, (base: number) => string | null>> = {
  webp: {
    1: (base) => `-${base}.webp`,
    2: (base) => `@2x-${base * 2}.webp`,
    3: (base) => `@3x-${base * 3}.webp`,
  },
  jpg: {
    1: (base) => `-${base}.jpg`,
    2: (base) => `@2x-${base * 2}.jpg`,
    3: () => null, // jpg-версий для 3x нет в ассетах
  },
};

const formatDescriptor = (density: Density) => `${density}x`;

const buildSrcSet = ({
  img,
  baseSize,
  format,
  densities,
}: {
  img: string;
  baseSize: number;
  format: ImageFormat;
  densities: Density[];
}) => {
  return densities
    .map((density) => {
      const suffix = DENSITY_SUFFIX[format][density]?.(baseSize);
      if (!suffix) {
        return null;
      }
      return `${getImageUrl(img, suffix)} ${formatDescriptor(density)}`;
    })
    .filter(Boolean)
    .join(', ');
};

/**
 * Компонент обложки альбома с поддержкой responsive-загрузки.
 */
function AlbumCover({
  img,
  fullName,
  size = DEFAULT_BASE_SIZE,
  densities,
  sizes,
  onColorsExtracted,
}: CoverProps & {
  onColorsExtracted?: (colors: { dominant: string; palette: string[] }) => void;
}) {
  const imgRef = useImageColor(img, onColorsExtracted);
  const effectiveBaseSize = size ?? DEFAULT_BASE_SIZE;

  const densitySteps = useMemo(() => {
    const unique = new Set<Density>((densities || DEFAULT_DENSITIES) as Density[]);
    // Гарантируем наличие 1x как базового варианта
    unique.add(1);
    return Array.from(unique).sort((a, b) => a - b) as Density[];
  }, [densities]);

  const webpSrcSet = useMemo(
    () =>
      buildSrcSet({ img, baseSize: effectiveBaseSize, format: 'webp', densities: densitySteps }),
    [img, effectiveBaseSize, densitySteps]
  );

  const jpegSrcSet = useMemo(
    () => buildSrcSet({ img, baseSize: effectiveBaseSize, format: 'jpg', densities: densitySteps }),
    [img, effectiveBaseSize, densitySteps]
  );

  const fallbackSrc = useMemo(() => {
    const primarySuffix = DENSITY_SUFFIX.jpg[1]?.(effectiveBaseSize);
    return primarySuffix ? getImageUrl(img, primarySuffix) : getImageUrl(img);
  }, [img, effectiveBaseSize]);

  const resolvedSizes =
    sizes ??
    `(max-width: 480px) 60vw, (max-width: 1024px) min(40vw, ${effectiveBaseSize}px), ${effectiveBaseSize}px`;

  return (
    <picture className="album-cover" role="img">
      <source
        className="album-cover__source"
        srcSet={webpSrcSet}
        sizes={resolvedSizes}
        type="image/webp"
      />
      <source
        className="album-cover__source"
        srcSet={jpegSrcSet}
        sizes={resolvedSizes}
        type="image/jpeg"
      />

      <img
        ref={imgRef}
        className="album-cover__image"
        loading="lazy"
        decoding="async"
        src={fallbackSrc}
        srcSet={jpegSrcSet}
        sizes={resolvedSizes}
        alt={`Обложка альбома ${fullName}`}
      />
    </picture>
  );
}

export default memo(AlbumCover, (prevProps, nextProps) => {
  const prevCallback = prevProps.onColorsExtracted;
  const nextCallback = nextProps.onColorsExtracted;
  const callbacksEqual = prevCallback === nextCallback || (!prevCallback && !nextCallback);

  return (
    prevProps.img === nextProps.img &&
    prevProps.fullName === nextProps.fullName &&
    prevProps.size === nextProps.size &&
    prevProps.densities === nextProps.densities &&
    prevProps.sizes === nextProps.sizes &&
    callbacksEqual
  );
});
