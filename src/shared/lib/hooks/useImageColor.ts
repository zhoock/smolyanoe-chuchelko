// src/components/UseImageColor/UseImageColor.tsx
import { useEffect, useRef } from 'react';

// Задача: нужно передать цвет от AlbumCover (внутри AudioPlayer) в Popup (в AlbumTracks).
// Это задача подъёма состояния (lifting state up).
// Решение: передаём setBgColor из AlbumTracks в AudioPlayer, а затем в AlbumCover.

// Добавляет ColorThief в window, чтобы TypeScript не ругался,
// если объект объявлен динамически (например, после загрузки внешнего скрипта).
declare global {
  interface Window {
    ColorThief: any;
  }
}

// Глобальный кеш для отслеживания уже обработанных изображений
const processedImagesCache = new Set<string>();

/**
 * Очищает кеш обработанных изображений для указанного пути.
 * Используется при смене альбома, чтобы принудительно переизвлечь цвета.
 */
export function clearImageColorCache(imgSrc: string): void {
  processedImagesCache.delete(imgSrc);
}

/* Этот хук useImageColor предназначен для извлечения доминантного цвета
 * и палитры из изображения с использованием библиотеки Color Thief.
 * Он загружает скрипт Color Thief при необходимости, обрабатывает изображение
 * и передаёт полученные цвета в onColorsExtracted.
 * */
export function useImageColor(
  // Путь к изображению.
  imgSrc: string,
  // Колбэк-функция, которая вызывается при успешном извлечении цветов.
  onColorsExtracted?: (colors: { dominant: string; palette: string[] }) => void
) {
  // Создание ref для изображения. Используется для хранения ссылки на изображение, с которого будет браться цвет.
  const imgRef = useRef<HTMLImageElement | null>(null);

  // Хук useEffect используется для выполнения побочных эффектов.
  // В данном случае он загружает Color Thief и извлекает цвета из изображения.
  useEffect(() => {
    if (!onColorsExtracted) return; // если нет onColorsExtracted, выход из эффекта

    // Проверяем кеш - если для этого изображения уже извлекались цвета, не делаем ничего
    // Кеш может быть очищен извне через clearImageColorCache при смене альбома
    if (processedImagesCache.has(imgSrc)) {
      return; // Цвета уже извлечены для этого изображения
    }

    // Проверяет, загружен ли уже Color Thief.
    // Если нет, создаёт <script> и добавляет в document.body.
    // Если уже загружен, сразу вызывает extractColors.
    const loadScript = () => {
      if (!document.querySelector('script[src*="color-thief"]')) {
        const script = document.createElement('script');
        script.src = 'https://cdnjs.cloudflare.com/ajax/libs/color-thief/2.3.2/color-thief.umd.js';
        script.onload = extractColors;
        document.body.appendChild(script);
      } else if (window.ColorThief) {
        extractColors();
      }
    };

    // Функция extractColors.
    const extractColors = () => {
      // Проверяет, доступен ли window.ColorThief.
      // Если нет — выводит ошибку и выходит.
      if (!window.ColorThief) {
        console.error('ColorThief не найден');
        return;
      }

      // Создаёт экземпляр ColorThief.
      // Берёт изображение из useRef.
      const colorThief = new window.ColorThief();
      const img = imgRef.current;
      if (!img) return;

      // Извлечение цветов
      const getColors = () => {
        try {
          // Получает основной цвет.
          const dominantColor = colorThief.getColor(img);
          // Получает палитру из 10 цветов.
          const palette = colorThief.getPalette(img, 10);

          // Помечаем изображение как обработанное ПЕРЕД вызовом колбэка
          processedImagesCache.add(imgSrc);

          // Преобразует массив [r, g, b] в строку "rgb(r, g, b)".
          // Вызывает onColorsExtracted.
          onColorsExtracted?.({
            dominant: `rgb(${dominantColor.join(',')})`,
            palette: palette.map((color: number[]) => `rgb(${color.join(',')})`),
          });
        } catch (error) {
          console.error('Ошибка при извлечении цветов:', error);
        }
      };

      // Обработка загрузки изображения.
      // Если изображение уже загружено — сразу извлекает цвета.
      // Если нет — ждёт onload и затем вызывает getColors.
      if (img.complete) {
        getColors();
      } else {
        img.onload = getColors;
      }
    };

    // Запуск скрипта.
    // Вызывает loadScript при каждом изменении imgSrc или onColorsExtracted.
    loadScript();
  }, [imgSrc, onColorsExtracted]);

  // Возвращаемый результат.
  // Хук возвращает ref, который нужно прикрепить к <img>,
  // чтобы Color Thief мог анализировать изображение.
  return imgRef;
}
