// netlify/functions/save-synced-lyrics.ts
/**
 * Netlify Serverless Function для сохранения синхронизированного текста песен.
 *
 * ВАЖНО: Для работы этой функции нужно:
 * 1. Установить зависимости для работы с файловой системой (если нужно сохранять в JSON)
 * 2. Настроить переменные окружения для доступа к хранилищу (если используется БД)
 * 3. Добавить аутентификацию для защиты endpoint (рекомендуется)
 *
 * Этот файл - пример структуры. Для реальной работы может понадобиться:
 * - Сохранение в файловую систему (если есть доступ)
 * - Сохранение в БД (MongoDB, PostgreSQL и т.д.)
 * - Интеграция с CMS (Contentful, Strapi и т.д.)
 *
 * Пример использования:
 * POST /api/save-synced-lyrics
 * Body: { albumId: string, trackId: string, lang: string, syncedLyrics: SyncedLyricsLine[] }
 */

import type { Handler, HandlerEvent, HandlerContext } from '@netlify/functions';

interface SaveSyncedLyricsRequest {
  albumId: string;
  trackId: string | number;
  lang: string;
  syncedLyrics: Array<{
    text: string;
    startTime: number;
    endTime?: number;
  }>;
}

interface SaveSyncedLyricsResponse {
  success: boolean;
  message?: string;
}

export const handler: Handler = async (
  event: HandlerEvent,
  context: HandlerContext
): Promise<{ statusCode: number; headers?: Record<string, string>; body: string }> => {
  // CORS headers для работы с фронтенда
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json',
  };

  // Обработка preflight запроса
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers,
      body: '',
    };
  }

  // Проверяем метод запроса
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({
        success: false,
        message: 'Method not allowed. Use POST.',
      } as SaveSyncedLyricsResponse),
    };
  }

  try {
    // Парсим тело запроса
    const data: SaveSyncedLyricsRequest = JSON.parse(event.body || '{}');

    // Валидация данных
    if (!data.albumId || !data.trackId || !data.lang || !Array.isArray(data.syncedLyrics)) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          success: false,
          message: 'Invalid request data. Required: albumId, trackId, lang, syncedLyrics[]',
        } as SaveSyncedLyricsResponse),
      };
    }

    // TODO: Здесь должна быть логика сохранения
    // Варианты:
    // 1. Сохранение в файловую систему (если есть доступ)
    // 2. Сохранение в БД (MongoDB, PostgreSQL и т.д.)
    // 3. Сохранение в CMS (Contentful, Strapi и т.д.)
    // 4. Отправка в Git репозиторий через GitHub API
    //
    // Пример для сохранения в файл (требует доступа к файловой системе):
    // const fs = require('fs');
    // const path = require('path');
    // const filePath = path.join(process.cwd(), 'src/assets', `albums-${data.lang}.json`);
    // const albums = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    // const album = albums.find((a: any) => a.albumId === data.albumId);
    // if (album) {
    //   const track = album.tracks.find((t: any) => String(t.id) === String(data.trackId));
    //   if (track) {
    //     track.syncedLyrics = data.syncedLyrics;
    //     fs.writeFileSync(filePath, JSON.stringify(albums, null, 2), 'utf8');
    //   }
    // }

    // Пока что просто логируем и возвращаем успех
    console.log('💾 Saving synced lyrics:', {
      albumId: data.albumId,
      trackId: data.trackId,
      lang: data.lang,
      linesCount: data.syncedLyrics.length,
    });

    // ВАЖНО: В реальной реализации здесь должно быть сохранение данных!

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        message: 'Synced lyrics saved successfully',
      } as SaveSyncedLyricsResponse),
    };
  } catch (error) {
    console.error('❌ Error saving synced lyrics:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        success: false,
        message: error instanceof Error ? error.message : 'Unknown error',
      } as SaveSyncedLyricsResponse),
    };
  }
};
