/**
 * Netlify Serverless Function для коммита обложки из черновиков в финальный путь
 *
 * Использование:
 * POST /api/albums/cover/commit
 * Authorization: Bearer <token>
 * Content-Type: application/json
 * Body: {
 *   draftKey: string (ключ черновика из upload-cover-draft),
 *   albumId: string (ID альбома)
 * }
 *
 * Возвращает:
 * {
 *   success: boolean,
 *   data?: {
 *     url: string (финальный URL обложки),
 *     storagePath: string (финальный путь в Storage)
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
import { extractBaseName } from './lib/image-processor';

const STORAGE_BUCKET_NAME = 'user-media';

function createSupabaseAdminClient() {
  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

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

interface CommitCoverRequest {
  draftKey: string;
  albumId: string;
  artist?: string;
  album?: string;
  lang?: 'ru' | 'en';
}

interface CommitCoverResponse {
  success: boolean;
  data?: {
    url: string;
    storagePath: string;
    baseName?: string; // Базовое имя обложки (без расширения и суффиксов)
    variants?: string[]; // Список закоммиченных вариантов
  };
  error?: string;
}

/**
 * Получает финальный путь в Storage для обложки альбома
 * Использует UUID пользователя из токена
 */
function getFinalStoragePath(userId: string, albumId: string, fileExtension: string): string {
  // Используем UUID пользователя из токена
  return `users/${userId}/albums/${albumId}-cover.${fileExtension}`;
}

/**
 * Извлекает расширение файла из пути черновика
 */
function getFileExtensionFromPath(path: string): string {
  const match = path.match(/\.(jpg|jpeg|png|webp)$/i);
  return match ? match[1].toLowerCase() : 'jpg';
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
    const body = parseJsonBody<Partial<CommitCoverRequest>>(event.body, {});

    const { draftKey, albumId } = body;

    // Валидация полей
    if (!draftKey || !albumId) {
      return createErrorResponse(400, 'Missing required fields: draftKey, albumId');
    }

    // Проверяем, что draftKey принадлежит текущему пользователю
    if (!draftKey.startsWith(`${userId}/`)) {
      return createErrorResponse(403, 'Forbidden. Draft key does not belong to current user.');
    }

    // Создаём Supabase клиент с service role key
    const supabase = createSupabaseAdminClient();
    if (!supabase) {
      return createErrorResponse(
        500,
        'Supabase admin client is not available. Please check environment variables.'
      );
    }

    // draftKey имеет формат: userId/albums/{albumId}/draft-cover или userId/albums/new/draft-cover
    // Для новых альбомов: userId/albums/new/draft-cover → drafts/userId/albums/new
    // Для существующих: userId/albums/{albumId}/draft-cover → drafts/userId/albums/{albumId}
    const draftKeyParts = draftKey.split('/');
    const draftFolder = `drafts/${draftKeyParts.slice(0, -1).join('/')}`;

    console.log('Looking for draft files in:', draftFolder);

    // Получаем список всех файлов в папке черновика
    const { data: draftFiles, error: listError } = await supabase.storage
      .from(STORAGE_BUCKET_NAME)
      .list(draftFolder, {
        limit: 100,
      });

    if (listError || !draftFiles || draftFiles.length === 0) {
      console.error('Draft files not found:', {
        draftKey,
        draftFolder,
        error: listError?.message,
      });
      return createErrorResponse(404, 'Draft files not found');
    }

    // Фильтруем только файлы обложки (содержат "cover" в имени, case-insensitive)
    const coverFiles = draftFiles.filter((f) => f.name.toLowerCase().includes('cover'));

    if (coverFiles.length === 0) {
      console.error('No cover files found in draft folder:', draftFolder);
      return createErrorResponse(404, 'No cover files found in draft');
    }

    console.log(`Found ${coverFiles.length} cover variants to commit`);

    // Определяем базовое имя из первого файла
    // Формат файлов: Groupe-Cover-Album-Name-{suffix}
    // Нужно извлечь часть до первого суффикса (-64, -128, -448, -896, -1344)
    const firstFileName = coverFiles[0].name;

    console.log('Extracting base name from:', {
      firstFileName,
      allFiles: coverFiles.map((f) => f.name),
    });

    // Извлекаем базовое имя, убирая все суффиксы
    // Паттерн: ищем последний суффикс перед расширением
    // Варианты суффиксов: -64, -128, -448, -896, -1344 (без @2x и @3x)
    const baseNameMatch = firstFileName.match(
      /^(.+?)(?:-64|-128|-448|-896|-1344)(?:\.(jpg|webp))$/
    );
    let finalBaseName: string;

    if (baseNameMatch) {
      // Используем извлеченное базовое имя
      finalBaseName = baseNameMatch[1];
      console.log('✅ Base name extracted via regex:', finalBaseName);
    } else {
      // Fallback: пытаемся извлечь через extractBaseName и убрать суффиксы вручную
      let baseName = extractBaseName(firstFileName);
      console.log('Base name after extractBaseName:', baseName);

      // Убираем возможные суффиксы (новый формат без @2x и @3x)
      const beforeSuffix = baseName.replace(/(?:-64|-128|-448|-896|-1344)$/, '');
      finalBaseName = beforeSuffix || `${albumId}-cover`;
      console.log('✅ Base name after removing suffix:', finalBaseName);
    }

    console.log('📝 Final base name for album:', {
      firstFileName,
      finalBaseName,
      albumId,
    });

    // Удаляем старые обложки альбома (если есть)
    // Используем UUID пользователя из токена
    const { data: existingFiles } = await supabase.storage
      .from(STORAGE_BUCKET_NAME)
      .list(`users/${userId}/albums`, {
        limit: 100,
      });

    // Ищем старые файлы по точному совпадению базового имени
    // ВАЖНО: используем точное совпадение, чтобы не удалить файлы других альбомов
    // Например, для albumId="23" не должны удаляться файлы "Cover-23-remastered"
    const oldCoverFiles =
      existingFiles
        ?.filter((f) => {
          // Проверяем точное совпадение базового имени (без суффиксов размера)
          // Убираем суффиксы размера и расширение для сравнения
          const nameWithoutSuffix = f.name.replace(
            /(?:-64|-128|-448|-896|-1344)(\.(jpg|webp))$/,
            ''
          );
          const nameWithoutExt = nameWithoutSuffix.replace(/\.(jpg|webp)$/, '');

          // Точное совпадение базового имени
          if (nameWithoutExt === finalBaseName) {
            return true;
          }

          // Также проверяем по albumId-cover для обратной совместимости
          // Но только если это не remastered версия
          if (f.name.startsWith(`${albumId}-cover`) && !f.name.includes('remastered')) {
            return true;
          }

          return false;
        })
        .map((f) => `users/${userId}/albums/${f.name}`) || [];

    if (oldCoverFiles.length > 0) {
      console.log(`Removing ${oldCoverFiles.length} old cover files`);
      await supabase.storage.from(STORAGE_BUCKET_NAME).remove(oldCoverFiles);
    }

    // Коммитим все варианты
    const committedFiles: string[] = [];
    const commitErrors: string[] = [];

    for (const draftFile of coverFiles) {
      const draftPath = `${draftFolder}/${draftFile.name}`;

      // Скачиваем файл из черновика
      const { data: draftData, error: downloadError } = await supabase.storage
        .from(STORAGE_BUCKET_NAME)
        .download(draftPath);

      if (downloadError || !draftData) {
        console.error(`Failed to download draft file ${draftFile.name}:`, downloadError?.message);
        commitErrors.push(`${draftFile.name}: ${downloadError?.message || 'Download failed'}`);
        continue;
      }

      // Извлекаем суффикс из имени файла (новый формат: "-64.webp", "-448.jpg", "-896.webp", "-1344.webp")
      const suffixMatch = draftFile.name.match(/(-\d+\.(jpg|webp))$/);
      const suffix = suffixMatch ? suffixMatch[0] : '';

      // Формируем финальное имя файла
      // Используем UUID пользователя из токена
      const finalFileName = suffix ? `${finalBaseName}${suffix}` : `${finalBaseName}.webp`;
      const finalPath = `users/${userId}/albums/${finalFileName}`;

      // Читаем данные файла
      const arrayBuffer = await draftData.arrayBuffer();
      const fileBuffer = Buffer.from(arrayBuffer);

      // Определяем Content-Type
      const contentType = finalFileName.endsWith('.webp') ? 'image/webp' : 'image/jpeg';

      // Загружаем в финальный путь
      // cacheControl: '0' - отключаем кэширование на уровне CDN/Supabase
      // Cache-bust на клиенте (через ?v=baseName) обеспечит обновление изображений
      const { error: uploadError } = await supabase.storage
        .from(STORAGE_BUCKET_NAME)
        .upload(finalPath, fileBuffer, {
          contentType,
          upsert: true,
          cacheControl: '0', // Отключаем кэширование, так как используем cache-bust на клиенте
        });

      if (uploadError) {
        console.error(`Error committing ${finalFileName}:`, uploadError.message);
        commitErrors.push(`${finalFileName}: ${uploadError.message}`);
      } else {
        committedFiles.push(finalFileName);
      }

      // Удаляем черновик после успешного коммита
      const { error: deleteError } = await supabase.storage
        .from(STORAGE_BUCKET_NAME)
        .remove([draftPath]);

      if (deleteError) {
        console.warn(
          `Failed to delete draft ${draftFile.name} (non-critical):`,
          deleteError.message
        );
      }
    }

    if (committedFiles.length === 0) {
      return createErrorResponse(
        500,
        `Failed to commit any cover files: ${commitErrors.join(', ')}`
      );
    }

    if (commitErrors.length > 0) {
      console.warn(`Some files failed to commit: ${commitErrors.join(', ')}`);
    }

    console.log(`✅ Committed ${committedFiles.length} cover variants`);

    // Получаем публичный URL базового файла для превью (используем 448.webp)
    // Используем UUID пользователя из токена
    const previewFileName = `${finalBaseName}-448.webp`;
    const previewPath = `users/${userId}/albums/${previewFileName}`;
    const { data: urlData } = supabase.storage.from(STORAGE_BUCKET_NAME).getPublicUrl(previewPath);

    return createSuccessResponse(
      {
        url: urlData.publicUrl,
        storagePath: previewPath,
        baseName: finalBaseName,
        variants: committedFiles,
      },
      200
    );
  } catch (error) {
    console.error('❌ Error in commit-cover function:', {
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
