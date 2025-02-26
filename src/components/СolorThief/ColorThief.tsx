import { useEffect, useRef } from 'react';

declare global {
  interface Window {
    ColorThief: any;
  }
}

export function useImageColor(
  imgSrc: string,
  onColorsExtracted?: (colors: {
    dominant: string;
    secondary?: string;
  }) => void,
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
          const palette = colorThief.getPalette(img, 5);
          const secondaryColor = palette?.[2]; // Берём второй цвет, если есть

          onColorsExtracted?.({
            dominant: `rgb(${dominantColor.join(',')})`,
            secondary: secondaryColor
              ? `rgb(${secondaryColor.join(',')})`
              : undefined,
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
