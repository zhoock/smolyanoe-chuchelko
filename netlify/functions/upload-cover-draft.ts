/**
 * Netlify Serverless Function для загрузки обложки альбома в черновики (drafts)
 *
 * Использование:
 * POST /api/albums/cover/draft
 * Authorization: Bearer <token>
 * Content-Type: application/json
 * Body: {
 *   fileBase64: string (base64 encoded file),
 *   albumId: string (ID альбома, если редактируем существующий),
 *   contentType?: string (опционально, по умолчанию 'image/jpeg')
 * }
 *
 * Возвращает:
 * {
 *   success: boolean,
 *   data?: {
 *     draftKey: string (ключ для коммита),
 *     url: string (URL превью),
 *     storagePath: string (путь в Storage)
 *   },
 *   error?: string
 * }
 */

import type { Handler, HandlerEvent, HandlerContext } from '@netlify/functions';
import { createClient } from '@supabase/supabase-js';
import {
  createOptionsResponse,
  createErrorResponse,
  createSuccessResponse,
  requireAuth,
  parseJsonBody,
} from './lib/api-helpers';
import { CURRENT_USER_CONFIG } from '../../src/config/user';
import { generateImageVariants } from './lib/image-processor';

const STORAGE_BUCKET_NAME = 'user-media';

function createSupabaseAdminClient() {
  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
  const serviceRoleKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || '';

  if (!supabaseUrl || !serviceRoleKey) {
    console.error('Supabase credentials not found', {
      hasUrl: !!supabaseUrl,
      hasServiceRoleKey: !!serviceRoleKey,
    });
    return null;
  }

  try {
    return createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    });
  } catch (error) {
    console.error('❌ Failed to create Supabase admin client:', error);
    return null;
  }
}

interface UploadCoverDraftRequest {
  fileBase64: string;
  albumId?: string; // ID альбома, если редактируем существующий
  artist?: string; // Название группы (для формирования имени файла)
  album?: string; // Название альбома (для формирования имени файла)
  contentType?: string;
  originalFileSize?: number;
  originalFileName?: string;
}

interface UploadCoverDraftResponse {
  success: boolean;
  data?: {
    draftKey: string; // Уникальный ключ для коммита: userId/albumId или userId/draft-timestamp
    url: string; // URL для превью
    storagePath: string; // Путь в Storage
  };
  error?: string;
}

/**
 * Генерирует уникальный ключ для черновика
 * Формат: userId/albums/{albumId}/draft-cover или userId/albums/new/draft-cover
 * ВАЖНО: путь должен совпадать с тем, куда загружаются файлы (drafts/${draftKey}/...)
 */
function generateDraftKey(userId: string, albumId?: string): string {
  if (albumId) {
    return `${userId}/albums/${albumId}/draft-cover`;
  }
  // Для новых альбомов используем "new" чтобы путь совпадал с upload (drafts/${userId}/albums/new/...)
  return `${userId}/albums/new/draft-cover`;
}

/**
 * Получает путь в Storage для черновика
 */
function getDraftStoragePath(draftKey: string, fileExtension: string = 'jpg'): string {
  return `drafts/${draftKey}.${fileExtension}`;
}

export const handler: Handler = async (event: HandlerEvent, context: HandlerContext) => {
  // CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return createOptionsResponse();
  }

  if (event.httpMethod !== 'POST') {
    return createErrorResponse(405, 'Method not allowed');
  }

  try {
    // Проверяем авторизацию
    const userId = requireAuth(event);
    if (!userId) {
      return createErrorResponse(401, 'Unauthorized. Please provide a valid token.');
    }

    // Парсим JSON body
    const body = parseJsonBody<Partial<UploadCoverDraftRequest>>(event.body, {});

    const { fileBase64, albumId, artist, album, contentType, originalFileSize } = body;

    // Логируем входящие данные для диагностики
    console.log('[upload-cover-draft] Request received:', {
      hasFileBase64: !!fileBase64,
      albumId,
      artist,
      album,
      contentType,
      originalFileSize,
      path: event.path,
      rawPath: event.rawPath,
    });

    if (!fileBase64) {
      return createErrorResponse(400, 'Missing required field: fileBase64');
    }

    // Создаём Supabase клиент с service role key
    const supabase = createSupabaseAdminClient();
    if (!supabase) {
      return createErrorResponse(
        500,
        'Supabase admin client is not available. Please check environment variables.'
      );
    }

    // Декодируем base64 в Buffer
    const originalBuffer = Buffer.from(fileBase64, 'base64');

    // Генерируем уникальный ключ для черновика
    const draftKey = generateDraftKey(userId, albumId);

    // Формируем базовое имя файла в формате: Groupe-Cover-Album-Name
    // Преобразуем в формат для файлов: латиница, дефисы вместо пробелов, убираем спецсимволы
    const formatForFileName = (str: string): string => {
      // Простая транслитерация кириллицы в латиницу
      const transliterationMap: Record<string, string> = {
        а: 'a',
        б: 'b',
        в: 'v',
        г: 'g',
        д: 'd',
        е: 'e',
        ё: 'yo',
        ж: 'zh',
        з: 'z',
        и: 'i',
        й: 'y',
        к: 'k',
        л: 'l',
        м: 'm',
        н: 'n',
        о: 'o',
        п: 'p',
        р: 'r',
        с: 's',
        т: 't',
        у: 'u',
        ф: 'f',
        х: 'h',
        ц: 'ts',
        ч: 'ch',
        ш: 'sh',
        щ: 'sch',
        ъ: '',
        ы: 'y',
        ь: '',
        э: 'e',
        ю: 'yu',
        я: 'ya',
      };

      return str
        .toLowerCase()
        .split('')
        .map((char) => {
          // Транслитерация кириллицы
          if (transliterationMap[char]) {
            return transliterationMap[char];
          }
          // Оставляем латиницу, цифры, пробелы и дефисы
          if (/[a-z0-9\s-]/.test(char)) {
            return char;
          }
          // Убираем все остальные символы
          return '';
        })
        .join('')
        .replace(/\s+/g, '-') // Пробелы в дефисы
        .replace(/-+/g, '-') // Множественные дефисы в один
        .replace(/^-|-$/g, ''); // Убираем дефисы в начале/конце
    };

    let baseName: string;
    if (artist && album) {
      // Формат: Groupe-Cover-Album-Name
      const groupeFormatted = formatForFileName(artist);
      const albumFormatted = formatForFileName(album);
      baseName = `${groupeFormatted}-Cover-${albumFormatted}`;
    } else if (albumId) {
      // Fallback: используем albumId
      baseName = `${albumId}-cover`;
    } else {
      baseName = `draft-${Date.now()}-cover`;
    }

    // Генерируем все варианты изображения
    console.log('🖼️ Generating image variants for:', baseName);
    const variants = await generateImageVariants(originalBuffer, baseName);

    // Удаляем старые черновики для этого альбома (включая новые альбомы)
    const draftFolder = `drafts/${userId}/albums/${albumId || 'new'}`;
    const { data: existingDrafts } = await supabase.storage
      .from(STORAGE_BUCKET_NAME)
      .list(draftFolder, {
        limit: 100,
      });

    if (existingDrafts && existingDrafts.length > 0) {
      const oldDrafts = existingDrafts
        .filter((f) => f.name.includes('cover'))
        .map((f) => `${draftFolder}/${f.name}`);

      if (oldDrafts.length > 0) {
        console.log(`🗑️ Removing ${oldDrafts.length} old draft files from ${draftFolder}`);
        await supabase.storage.from(STORAGE_BUCKET_NAME).remove(oldDrafts);
      }
    }

    // Загружаем все варианты в черновики
    const uploadedFiles: string[] = [];
    const uploadErrors: string[] = [];

    for (const [fileName, buffer] of Object.entries(variants)) {
      const draftPath = `drafts/${userId}/albums/${albumId || 'new'}/${fileName}`;
      const contentType = fileName.endsWith('.webp') ? 'image/webp' : 'image/jpeg';

      const { data, error } = await supabase.storage
        .from(STORAGE_BUCKET_NAME)
        .upload(draftPath, buffer, {
          contentType,
          upsert: true,
          cacheControl: 'no-cache',
        });

      if (error) {
        console.error(`Error uploading variant ${fileName}:`, error.message);
        uploadErrors.push(`${fileName}: ${error.message}`);
      } else {
        uploadedFiles.push(fileName);
      }
    }

    if (uploadErrors.length > 0) {
      console.error('Some variants failed to upload:', uploadErrors);
      // Не возвращаем ошибку, если хотя бы один файл загружен
      if (uploadedFiles.length === 0) {
        return createErrorResponse(
          500,
          `Failed to upload any variants: ${uploadErrors.join(', ')}`
        );
      }
    }

    // Используем базовый вариант для превью (448.webp)
    const previewFileName = `${baseName}-448.webp`;
    const previewPath = `drafts/${userId}/albums/${albumId || 'new'}/${previewFileName}`;
    const { data: urlData } = supabase.storage.from(STORAGE_BUCKET_NAME).getPublicUrl(previewPath);

    console.log(`✅ Uploaded ${uploadedFiles.length} image variants`);

    return createSuccessResponse(
      {
        draftKey,
        url: urlData.publicUrl,
        storagePath: previewPath,
        variants: uploadedFiles,
      },
      200
    );
  } catch (error) {
    console.error('❌ Error in upload-cover-draft function:', {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      name: error instanceof Error ? error.name : 'Unknown',
      timestamp: new Date().toISOString(),
    });
    return createErrorResponse(
      500,
      error instanceof Error ? error.message : 'Internal server error'
    );
  }
};
