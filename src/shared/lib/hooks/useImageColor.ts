// src/shared/lib/hooks/useImageColor.ts
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
      const existingScript = document.querySelector('script[src*="color-thief"]');
      if (!existingScript) {
        const script = document.createElement('script');
        script.src = 'https://cdnjs.cloudflare.com/ajax/libs/color-thief/2.3.2/color-thief.umd.js';
        script.onload = () => {
          // Небольшая задержка для гарантии инициализации в мобильных браузерах
          setTimeout(extractColors, 50);
        };
        script.onerror = () => {
          console.error('Ошибка загрузки ColorThief скрипта');
        };
        document.body.appendChild(script);
      } else if (window.ColorThief) {
        // Если скрипт уже загружен, вызываем extractColors с небольшой задержкой
        setTimeout(extractColors, 50);
      } else {
        // Скрипт есть в DOM, но еще не загружен - ждем события загрузки
        existingScript.addEventListener('load', () => {
          setTimeout(extractColors, 50);
        });
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
          // В мобильных браузерах img.complete может быть true, но изображение еще не готово
          // Проверяем naturalWidth и naturalHeight для гарантии готовности
          if (img.naturalWidth === 0 || img.naturalHeight === 0) {
            // Изображение еще не загружено полностью, ждем следующего события
            if (!img.complete) {
              img.onload = getColors;
            } else {
              // Если complete=true, но размеры 0, пробуем через небольшую задержку
              setTimeout(() => {
                if (img.naturalWidth > 0 && img.naturalHeight > 0) {
                  getColors();
                }
              }, 100);
            }
            return;
          }

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
          // При ошибке не добавляем в кеш, чтобы можно было повторить попытку
        }
      };

      // Обработка загрузки изображения.
      // Если изображение уже загружено — проверяем готовность и извлекаем цвета.
      // Если нет — ждём onload и затем вызываем getColors.
      if (img.complete && img.naturalWidth > 0 && img.naturalHeight > 0) {
        // Изображение полностью загружено и готово
        getColors();
      } else {
        // Ждем загрузки изображения
        const handleLoad = () => {
          img.removeEventListener('load', handleLoad);
          img.removeEventListener('error', handleError);
          // Небольшая задержка для гарантии готовности в мобильных браузерах
          setTimeout(getColors, 50);
        };
        const handleError = () => {
          img.removeEventListener('load', handleLoad);
          img.removeEventListener('error', handleError);
          console.error('Ошибка загрузки изображения для извлечения цветов:', imgSrc);
        };
        img.addEventListener('load', handleLoad);
        img.addEventListener('error', handleError);
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
