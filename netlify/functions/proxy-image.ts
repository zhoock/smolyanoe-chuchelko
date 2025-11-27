/**
 * Netlify Function для проксирования изображений из Supabase Storage
 * с добавлением CORS заголовков для работы ColorThief
 */

import type { Handler, HandlerEvent, HandlerContext } from '@netlify/functions';

export const handler: Handler = async (
  event: HandlerEvent,
  context: HandlerContext
): Promise<{ statusCode: number; headers: Record<string, string>; body: string }> => {
  // CORS headers для работы с фронтенда
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Expose-Headers': '*',
  };

  // Обработка preflight запроса
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: corsHeaders,
      body: '',
    };
  }

  // Проверяем метод запроса
  if (event.httpMethod !== 'GET') {
    return {
      statusCode: 405,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'Method not allowed. Use GET.' }),
    };
  }

  try {
    // Получаем путь к изображению из query параметра
    const imagePath = event.queryStringParameters?.path;
    if (!imagePath) {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({ error: 'Missing "path" query parameter' }),
      };
    }

    // Получаем URL Supabase Storage из переменных окружения
    const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
    const bucketName = 'user-media';

    if (!supabaseUrl) {
      return {
        statusCode: 500,
        headers: corsHeaders,
        body: JSON.stringify({ error: 'Supabase URL not configured' }),
      };
    }

    // Формируем полный URL к изображению в Supabase Storage
    const imageUrl = `${supabaseUrl}/storage/v1/object/public/${bucketName}/${imagePath}`;

    // Загружаем изображение из Supabase
    const response = await fetch(imageUrl);

    if (!response.ok) {
      return {
        statusCode: response.status,
        headers: corsHeaders,
        body: JSON.stringify({ error: 'Failed to fetch image from Supabase' }),
      };
    }

    // Получаем изображение как blob
    const imageBlob = await response.blob();
    const imageBuffer = await imageBlob.arrayBuffer();

    // Определяем Content-Type из ответа Supabase или по расширению файла
    const contentType = response.headers.get('content-type') || 'image/jpeg';

    // Возвращаем изображение с CORS заголовками
    return {
      statusCode: 200,
      headers: {
        ...corsHeaders,
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
      body: Buffer.from(imageBuffer).toString('base64'),
      isBase64Encoded: true,
    };
  } catch (error) {
    console.error('Error proxying image:', error);
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'Internal server error' }),
    };
  }
};
