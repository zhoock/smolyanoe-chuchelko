/**
 * Netlify Function для проксирования изображений из Supabase Storage
 * с добавлением CORS заголовков для работы ColorThief
 */

import type { Handler, HandlerEvent, HandlerContext } from '@netlify/functions';

export const handler: Handler = async (
  event: HandlerEvent,
  context: HandlerContext
): Promise<{
  statusCode: number;
  headers: Record<string, string>;
  body: string;
  isBase64Encoded?: boolean;
}> => {
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
    console.error('[proxy-image] Invalid method:', event.httpMethod);
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
      console.error('[proxy-image] Missing path parameter');
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({ error: 'Missing "path" query parameter' }),
      };
    }

    // Получаем URL Supabase Storage из переменных окружения
    // В Netlify Functions переменные окружения доступны без VITE_ префикса
    // Сначала проверяем переменные без префикса (для продакшена), затем с префиксом (для локальной разработки)
    const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
    const bucketName = 'user-media';

    if (!supabaseUrl) {
      console.error('[proxy-image] Supabase URL not configured');
      return {
        statusCode: 500,
        headers: corsHeaders,
        body: JSON.stringify({ error: 'Supabase URL not configured' }),
      };
    }

    // Декодируем путь (на случай если он был закодирован дважды)
    const decodedPath = decodeURIComponent(imagePath);

    console.log('[proxy-image] Request details:', {
      originalPath: imagePath,
      decodedPath,
      bucketName,
    });

    // Формируем полный URL к изображению в Supabase Storage
    const imageUrl = `${supabaseUrl}/storage/v1/object/public/${bucketName}/${decodedPath}`;

    console.log('[proxy-image] Fetching from Supabase:', imageUrl);

    // Загружаем изображение из Supabase
    let response = await fetch(imageUrl);

    console.log('[proxy-image] Response status:', response.status, response.statusText);

    // Если файл не найден (404 или 400), пытаемся найти альтернативные варианты
    if (!response.ok && (response.status === 404 || response.status === 400)) {
      // Извлекаем базовое имя и расширение
      const pathMatch = decodedPath.match(
        /^(.+?\/)(.+?)(?:-64|-128|-448|-896|-1344)(\.(jpg|webp))$/
      );

      if (pathMatch) {
        const [, folder, baseName, , ext] = pathMatch;
        const extension = ext || 'webp';

        // Список вариантов для fallback (от меньшего к большему)
        // Новый формат: без @2x и @3x, просто размеры
        const fallbackVariants = [
          '-64.webp',
          '-64.jpg',
          '-128.webp',
          '-128.jpg',
          '-448.webp',
          '-448.jpg',
          '-896.webp',
          '-896.jpg',
          '-1344.webp',
          `.${extension}`, // Базовое имя без суффикса
        ];

        // Пробуем каждый вариант
        for (const variant of fallbackVariants) {
          const fallbackPath = `${folder}${baseName}${variant}`;
          const fallbackUrl = `${supabaseUrl}/storage/v1/object/public/${bucketName}/${fallbackPath}`;
          console.log('[proxy-image] Trying fallback path:', fallbackPath);

          const fallbackResponse = await fetch(fallbackUrl);
          if (fallbackResponse.ok) {
            response = fallbackResponse;
            console.log('[proxy-image] Found fallback:', fallbackPath);
            break;
          }
        }

        // Если не нашли с новым именем, пробуем со старым (Tar-Baby-Cover)
        if (!response.ok && baseName.includes('smolyanoe-chuchelko-Cover')) {
          const oldBaseName = baseName.replace(/smolyanoe-chuchelko-Cover/g, 'Tar-Baby-Cover');
          console.log('[proxy-image] Trying old name format:', oldBaseName);

          for (const variant of fallbackVariants) {
            const oldPath = `${folder}${oldBaseName}${variant}`;
            const oldUrl = `${supabaseUrl}/storage/v1/object/public/${bucketName}/${oldPath}`;
            console.log('[proxy-image] Trying old path:', oldPath);

            const oldResponse = await fetch(oldUrl);
            if (oldResponse.ok) {
              response = oldResponse;
              console.log('[proxy-image] Found old format:', oldPath);
              break;
            }
          }
        }
      } else {
        // Если паттерн не совпал, пробуем базовое имя без суффиксов
        const baseNameMatch = decodedPath.match(
          /^(.+?)(?:-64|-128|-448|-896|-1344)(\.(jpg|webp))$/
        );
        if (baseNameMatch) {
          const basePath = `${baseNameMatch[1]}${baseNameMatch[2]}`;
          const fallbackUrl = `${supabaseUrl}/storage/v1/object/public/${bucketName}/${basePath}`;
          console.log('[proxy-image] Trying fallback path:', basePath);
          response = await fetch(fallbackUrl);

          // Если не нашли, пробуем со старым именем
          if (!response.ok && basePath.includes('smolyanoe-chuchelko-Cover')) {
            const oldPath = basePath.replace(/smolyanoe-chuchelko-Cover/g, 'Tar-Baby-Cover');
            const oldUrl = `${supabaseUrl}/storage/v1/object/public/${bucketName}/${oldPath}`;
            console.log('[proxy-image] Trying old path:', oldPath);
            response = await fetch(oldUrl);
          }
        }
      }
    }

    if (!response.ok) {
      console.error('[proxy-image] Failed to fetch image:', {
        status: response.status,
        statusText: response.statusText,
        originalPath: decodedPath,
        url: imageUrl,
      });
      return {
        statusCode: response.status,
        headers: corsHeaders,
        body: JSON.stringify({
          error: 'Failed to fetch image from Supabase',
          status: response.status,
          statusText: response.statusText,
          url: imageUrl,
          path: decodedPath,
        }),
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
