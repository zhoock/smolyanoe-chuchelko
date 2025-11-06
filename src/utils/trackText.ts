// src/utils/trackText.ts
/**
 * Утилиты для работы с текстом трека.
 * Сохранение текста в API или localStorage (для разработки).
 */

export interface SaveTrackTextRequest {
  albumId: string;
  trackId: string | number;
  lang: string;
  content: string;
  authorship?: string;
}

export interface SaveTrackTextResponse {
  success: boolean;
  message?: string;
}

/**
 * Сохраняет текст трека.
 *
 * В режиме разработки (development) сохраняет в localStorage.
 * В продакшене должен отправлять запрос на API endpoint.
 *
 * @param data - данные текста для сохранения
 * @returns Promise с результатом сохранения
 */
export async function saveTrackText(data: SaveTrackTextRequest): Promise<SaveTrackTextResponse> {
  // В режиме разработки сохраняем в localStorage
  if (process.env.NODE_ENV === 'development') {
    try {
      const key = `track-text-${data.lang}-${data.albumId}-${data.trackId}`;
      localStorage.setItem(key, data.content);

      // Сохраняем авторство отдельно, если оно есть
      if (data.authorship !== undefined) {
        const authorshipKey = `track-text-authorship-${data.lang}-${data.albumId}-${data.trackId}`;
        localStorage.setItem(authorshipKey, data.authorship);
      }

      console.log('✅ Текст трека сохранён в localStorage:', {
        albumId: data.albumId,
        trackId: data.trackId,
        lang: data.lang,
        contentLength: data.content.length,
        hasAuthorship: data.authorship !== undefined,
      });

      return {
        success: true,
        message: 'Текст сохранён в localStorage (dev mode)',
      };
    } catch (error) {
      console.error('❌ Ошибка сохранения в localStorage:', error);
      return {
        success: false,
        message: `Ошибка сохранения: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }

  // В продакшене отправляем на API endpoint
  try {
    const response = await fetch('/api/save-track-text', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const result: SaveTrackTextResponse = await response.json();
    return result;
  } catch (error) {
    console.error('❌ Ошибка сохранения текста:', error);
    return {
      success: false,
      message: `Ошибка сохранения: ${error instanceof Error ? error.message : 'Unknown error'}`,
    };
  }
}

/**
 * Загружает текст трека из localStorage (для разработки).
 * В продакшене должен загружаться из API или из основного JSON файла.
 */
export function loadTrackTextFromStorage(
  albumId: string,
  trackId: string | number,
  lang: string
): string | null {
  if (process.env.NODE_ENV !== 'development') {
    return null;
  }

  try {
    const key = `track-text-${lang}-${albumId}-${trackId}`;
    return localStorage.getItem(key);
  } catch (error) {
    console.error('❌ Ошибка загрузки текста из localStorage:', error);
    return null;
  }
}

/**
 * Форматирует текст: удаляет лишние пробелы, нормализует переносы строк,
 * добавляет пробелы после знаков препинания
 */
export function formatTrackText(text: string): string {
  // Удаляем табы, заменяем на пробелы
  let formatted = text.replace(/\t/g, ' ');

  // Добавляем пробелы после знаков препинания, если их нет
  // Обрабатываем: запятая, точка с запятой, двоеточие
  // Не трогаем точку, восклицательный и вопросительный знаки (они могут быть в конце строки)
  // Используем негативный просмотр вперёд, чтобы не добавлять пробел, если:
  // - уже есть пробел после знака
  // - это конец строки или текста
  // - это цифра (для десятичных чисел)
  formatted = formatted.replace(/,([^\s\n\d])/g, ', $1'); // запятая
  formatted = formatted.replace(/;([^\s\n])/g, '; $1'); // точка с запятой
  formatted = formatted.replace(/:([^\s\n])/g, ': $1'); // двоеточие

  // Удаляем множественные пробелы, оставляем одинарные
  formatted = formatted.replace(/[ ]+/g, ' ');

  // Нормализуем переносы строк (убираем лишние)
  // Оставляем максимум 2 пустые строки подряд
  formatted = formatted.replace(/\n{3,}/g, '\n\n');

  // Убираем пробелы в начале и конце строк
  formatted = formatted
    .split('\n')
    .map((line) => line.trim())
    .join('\n');

  // Убираем пробелы в начале и конце всего текста
  return formatted.trim();
}

/**
 * Разбивает текст на строки для предпросмотра
 */
export function splitTextIntoLines(text: string): string[] {
  return text.split('\n').filter((line) => line.trim().length > 0);
}

/**
 * Подсчитывает количество строк в тексте
 */
export function countLines(text: string): number {
  return splitTextIntoLines(text).length;
}
