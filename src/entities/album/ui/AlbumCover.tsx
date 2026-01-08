// src/entities/album/ui/AlbumCover.tsx
import { memo, useMemo } from 'react';
import { getUserImageUrl, getImageUrl } from '@shared/api/albums';
import type { CoverProps } from 'models';
import { useImageColor } from '@shared/lib/hooks/useImageColor';

type ImageFormat = 'webp' | 'jpg';
type Density = 1 | 2 | 3;

const DEFAULT_BASE_SIZE = 448;
const DEFAULT_DENSITIES: Density[] = [1, 2, 3];

// Локальные ассеты (не Supabase деривативы)
const DENSITY_SUFFIX: Record<ImageFormat, Record<Density, (base: number) => string | null>> = {
  webp: {
    1: (base) => `-${base}.webp`,
    2: (base) => `@2x-${base * 2}.webp`,
    3: (base) => `@3x-${base * 3}.webp`,
  },
  jpg: {
    1: (base) => `-${base}.jpg`,
    2: (base) => `@2x-${base * 2}.jpg`,
    3: () => null,
  },
};

// Supabase деривативы фиксированы (по твоему описанию)
const SUPA_WEBP_SIZES = [448, 896, 1344] as const;
const SUPA_JPG_SIZES = [448, 896] as const;

const formatDescriptor = (density: Density) => `${density}x`;

function withCacheBust(url: string, cacheBust?: string) {
  if (!cacheBust) return url;
  const sep = url.includes('?') ? '&' : '?';
  return `${url}${sep}v=${encodeURIComponent(cacheBust)}`;
}

function isSupabaseStorageEnabled() {
  // Всегда используем Supabase Storage для медиа (обложки/аудио)
  // Это должно совпадать с shouldUseSupabaseStorage() в src/shared/api/albums/index.ts
  return true;
}

/**
 * Берём "не меньше цели", чтобы не апскейлить (лучше чуть больше, чем меньше).
 * Если всё меньше — берём максимальный.
 */
function pickCeilOrMax(target: number, candidates: readonly number[]) {
  for (const c of candidates) {
    if (c >= target) return c;
  }
  return candidates[candidates.length - 1];
}

function supaSuffix(format: ImageFormat, targetPx: number): string | null {
  if (format === 'webp') {
    const px = pickCeilOrMax(targetPx, SUPA_WEBP_SIZES);
    return `-${px}.webp`;
  }
  const px = pickCeilOrMax(targetPx, SUPA_JPG_SIZES);
  return `-${px}.jpg`;
}

const buildSrcSet = ({
  img,
  baseSize,
  format,
  densities,
  cacheBust,
  userId,
}: {
  img: string;
  baseSize: number;
  format: ImageFormat;
  densities: Density[];
  cacheBust?: string;
  userId?: string | null;
}) => {
  const useSupabaseStorage = isSupabaseStorageEnabled();

  return densities
    .map((density) => {
      let suffix: string | null = null;

      if (useSupabaseStorage) {
        // Supabase деривативы -448/-896/-1344 (webp) и -448/-896 (jpg)
        suffix = supaSuffix(format, baseSize * density);
      } else {
        suffix = DENSITY_SUFFIX[format][density]?.(baseSize) ?? null;
      }

      if (!suffix) return null;

      // Используем userId из пропсов или fallback на текущего пользователя
      const url = userId
        ? getImageUrl(img, suffix, { userId, category: 'albums', useSupabaseStorage })
        : getUserImageUrl(img, 'albums', suffix);
      return `${withCacheBust(url, cacheBust)} ${formatDescriptor(density)}`;
    })
    .filter(Boolean)
    .join(', ');
};

/**
 * Компонент обложки альбома с responsive-загрузкой.
 */
function AlbumCover({
  img,
  fullName,
  size = DEFAULT_BASE_SIZE,
  densities,
  sizes,
  userId,
  onColorsExtracted,
}: CoverProps & {
  onColorsExtracted?: (colors: { dominant: string; palette: string[] }) => void;
}) {
  const imgRef = useImageColor(img, onColorsExtracted);
  const effectiveBaseSize = size ?? DEFAULT_BASE_SIZE;

  const densitySteps = useMemo(() => {
    const unique = new Set<Density>((densities || DEFAULT_DENSITIES) as Density[]);
    unique.add(1);
    return Array.from(unique).sort((a, b) => a - b) as Density[];
  }, [densities]);

  /**
   * cacheBust уникальный на монтирование + пересчитывается при смене img
   */
  const cacheBust = useMemo(() => `${Date.now()}`, [img]);

  const webpSrcSet = useMemo(
    () =>
      buildSrcSet({
        img,
        baseSize: effectiveBaseSize,
        format: 'webp',
        densities: densitySteps,
        cacheBust,
        userId,
      }),
    [img, effectiveBaseSize, densitySteps, cacheBust, userId]
  );

  const jpegSrcSet = useMemo(
    () =>
      buildSrcSet({
        img,
        baseSize: effectiveBaseSize,
        format: 'jpg',
        densities: densitySteps,
        cacheBust,
        userId,
      }),
    [img, effectiveBaseSize, densitySteps, cacheBust, userId]
  );

  const fallbackSrc = useMemo(() => {
    const useSupabaseStorage = isSupabaseStorageEnabled();

    if (useSupabaseStorage) {
      const suffix = supaSuffix('webp', effectiveBaseSize) ?? '-448.webp';
      const url = userId
        ? getImageUrl(img, suffix, { userId, category: 'albums', useSupabaseStorage })
        : getUserImageUrl(img, 'albums', suffix);
      return withCacheBust(url, cacheBust);
    }

    const primarySuffix = DENSITY_SUFFIX.jpg[1]?.(effectiveBaseSize);
    const baseUrl = userId
      ? primarySuffix
        ? getImageUrl(img, primarySuffix, { userId, category: 'albums' })
        : getImageUrl(img, '.jpg', { userId, category: 'albums' })
      : primarySuffix
        ? getUserImageUrl(img, 'albums', primarySuffix)
        : getUserImageUrl(img, 'albums');

    return withCacheBust(baseUrl, cacheBust);
  }, [img, effectiveBaseSize, cacheBust, userId]);

  const resolvedSizes =
    sizes ??
    `(max-width: 480px) 60vw, (max-width: 1024px) min(40vw, ${effectiveBaseSize}px), ${effectiveBaseSize}px`;

  return (
    <picture className="album-cover">
      <source srcSet={webpSrcSet} sizes={resolvedSizes} type="image/webp" />
      <source srcSet={jpegSrcSet} sizes={resolvedSizes} type="image/jpeg" />

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
    prevProps.userId === nextProps.userId &&
    callbacksEqual
  );
});
