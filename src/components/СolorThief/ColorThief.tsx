import { useEffect, useRef } from 'react';

// Задача: нужно передать цвет от AlbumCover (внутри AudioPlayer) в Popup (в AlbumTracks).
// Это задача подъёма состояния (lifting state up).
// Решение: передаём setBgColor из AlbumTracks в AudioPlayer, а затем в AlbumCover.

declare global {
  interface Window {
    ColorThief: any;
  }
}

export function useImageColor(
  imgSrc: string,
  onColorsExtracted?: (colors: { dominant: string; palette: string[] }) => void,
) {
  const imgRef = useRef<HTMLImageElement | null>(null);

  useEffect(() => {
    if (!onColorsExtracted) return;

    const loadScript = () => {
      if (!document.querySelector('script[src*="color-thief"]')) {
        const script = document.createElement('script');
        script.src =
          'https://cdnjs.cloudflare.com/ajax/libs/color-thief/2.3.2/color-thief.umd.js';
        script.onload = extractColors;
        document.body.appendChild(script);
      } else if (window.ColorThief) {
        extractColors();
      }
    };

    const extractColors = () => {
      if (!window.ColorThief) {
        console.error('ColorThief не найден');
        return;
      }

      const colorThief = new window.ColorThief();
      const img = imgRef.current;
      if (!img) return;

      const getColors = () => {
        try {
          const dominantColor = colorThief.getColor(img);
          const palette = colorThief.getPalette(img, 10);

          onColorsExtracted?.({
            dominant: `rgb(${dominantColor.join(',')})`,
            palette: palette.map(
              (color: number[]) => `rgb(${color.join(',')})`,
            ), // Преобразуем в строковый формат
          });
        } catch (error) {
          console.error('Ошибка при извлечении цветов:', error);
        }
      };

      if (img.complete) {
        getColors();
      } else {
        img.onload = getColors;
      }
    };

    loadScript();
  }, [imgSrc, onColorsExtracted]);

  return imgRef;
}
