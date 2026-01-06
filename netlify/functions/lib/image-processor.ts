/**
 * Утилиты для обработки изображений с помощью sharp
 */

import sharp from 'sharp';

export interface ImageVariant {
  suffix: string; // например, "-448.jpg", "-896.webp" (новый формат без @2x и @3x)
  width: number;
  height?: number; // если не указано, будет пропорционально
  format: 'jpg' | 'webp' | 'avif';
  quality?: number; // для jpg/webp/avif
}

/**
 * Генерирует все варианты изображения согласно спецификации
 * @param imageBuffer - исходное изображение
 * @param baseName - базовое имя файла (без расширения и суффиксов)
 * @returns объект с буферами всех вариантов
 */
export async function generateImageVariants(
  imageBuffer: Buffer,
  baseName: string
): Promise<Record<string, Buffer>> {
  // Определяем варианты согласно спецификации
  // Новый формат: без @2x и @3x, просто размеры: -64, -128, -448, -896, -1344
  const variants: ImageVariant[] = [
    { suffix: '-64.jpg', width: 64, format: 'jpg', quality: 85 },
    { suffix: '-64.webp', width: 64, format: 'webp', quality: 85 },
    { suffix: '-128.jpg', width: 128, format: 'jpg', quality: 85 },
    { suffix: '-128.webp', width: 128, format: 'webp', quality: 85 },
    { suffix: '-448.jpg', width: 448, format: 'jpg', quality: 85 },
    { suffix: '-448.webp', width: 448, format: 'webp', quality: 85 },
    { suffix: '-896.jpg', width: 896, format: 'jpg', quality: 85 },
    { suffix: '-896.webp', width: 896, format: 'webp', quality: 85 },
    { suffix: '-1344.webp', width: 1344, format: 'webp', quality: 85 },
  ];

  const results: Record<string, Buffer> = {};

  // Получаем метаданные исходного изображения для сохранения пропорций
  const metadata = await sharp(imageBuffer).metadata();
  const originalWidth = metadata.width || 1;
  const originalHeight = metadata.height || 1;
  const aspectRatio = originalWidth / originalHeight;

  // Генерируем каждый вариант
  for (const variant of variants) {
    const height = variant.height || Math.round(variant.width / aspectRatio);

    let sharpInstance = sharp(imageBuffer).resize(variant.width, height, {
      fit: 'cover', // обрезаем, чтобы заполнить размер
      position: 'center',
    });

    // Применяем формат и качество
    if (variant.format === 'webp') {
      sharpInstance = sharpInstance.webp({ quality: variant.quality || 85 });
    } else if (variant.format === 'jpg') {
      sharpInstance = sharpInstance.jpeg({ quality: variant.quality || 85, mozjpeg: true });
    }

    const buffer = await sharpInstance.toBuffer();
    const fileName = `${baseName}${variant.suffix}`;
    results[fileName] = buffer;
  }

  return results;
}

/**
 * Генерирует варианты изображений для hero секции (большие размеры для фона)
 * @param imageBuffer - исходное изображение
 * @param baseName - базовое имя файла (без расширения и суффиксов)
 * @returns объект с буферами всех вариантов
 */
export async function generateHeroImageVariants(
  imageBuffer: Buffer,
  baseName: string
): Promise<Record<string, Buffer>> {
  // Варианты для hero изображений: оптимизированное количество
  // Используем только один размер (1920px) и несколько форматов для уменьшения времени обработки
  // Browser выберет оптимальный формат из image-set()
  const variants: ImageVariant[] = [
    // Desktop Full HD - основной размер для hero
    { suffix: '-1920.avif', width: 1920, format: 'avif', quality: 80 },
    { suffix: '-1920.webp', width: 1920, format: 'webp', quality: 85 },
    { suffix: '-1920.jpg', width: 1920, format: 'jpg', quality: 85 },
  ];

  const results: Record<string, Buffer> = {};

  // Получаем метаданные исходного изображения для сохранения пропорций
  const metadata = await sharp(imageBuffer).metadata();
  const originalWidth = metadata.width || 1;
  const originalHeight = metadata.height || 1;
  const aspectRatio = originalWidth / originalHeight;

  // Генерируем каждый вариант
  for (const variant of variants) {
    const height = variant.height || Math.round(variant.width / aspectRatio);

    let sharpInstance = sharp(imageBuffer).resize(variant.width, height, {
      fit: 'cover', // обрезаем, чтобы заполнить размер
      position: 'center',
    });

    // Применяем формат и качество
    if (variant.format === 'avif') {
      sharpInstance = sharpInstance.avif({ quality: variant.quality || 80 });
    } else if (variant.format === 'webp') {
      sharpInstance = sharpInstance.webp({ quality: variant.quality || 85 });
    } else if (variant.format === 'jpg') {
      sharpInstance = sharpInstance.jpeg({ quality: variant.quality || 85, mozjpeg: true });
    }

    const buffer = await sharpInstance.toBuffer();
    const fileName = `${baseName}${variant.suffix}`;
    results[fileName] = buffer;
  }

  return results;
}

/**
 * Получает базовое имя файла из полного пути или простого имени файла
 * @param pathOrFileName - полный путь в Storage (например "users/zhoock/albums/23-cover.webp") или простое имя файла (например "hero-123.jpg")
 * @returns базовое имя без расширения и суффиксов размеров, например "hero-123" или "23-cover"
 */
export function extractBaseName(pathOrFileName: string): string {
  // Извлекаем имя файла из пути (если это путь) или используем как есть (если это просто имя файла)
  const fileName = pathOrFileName.includes('/')
    ? pathOrFileName.split('/').pop() || ''
    : pathOrFileName;
  // Убираем расширение и суффиксы размеров
  // Паттерн: -640.jpg, -1920.avif, -2560.webp и т.д.
  return fileName
    .replace(/[-.](640|1280|1920|2560|64|128|448|896|1344)\.(jpg|jpeg|png|webp|avif)$/i, '')
    .replace(/\.(jpg|jpeg|png|webp|avif)$/i, '');
}
