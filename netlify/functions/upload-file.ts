/**
 * Netlify Serverless Function для загрузки файлов в Supabase Storage
 *
 * Использование:
 * POST /api/upload-file
 * Content-Type: multipart/form-data
 * Body: {
 *   file: File,
 *   userId: string (опционально),
 *   category: 'albums' | 'articles' | 'profile' | 'uploads' | 'stems',
 *   fileName: string (опционально, если не указан - используется имя из file)
 * }
 */

import type { Handler, HandlerEvent, HandlerContext } from '@netlify/functions';
import { createSupabaseClient, STORAGE_BUCKET_NAME } from '../../src/config/supabase';
import type { ImageCategory } from '../../src/config/user';

interface UploadFileRequest {
  file: File | Blob;
  userId?: string;
  category: ImageCategory;
  fileName?: string;
}

interface UploadFileResponse {
  success: boolean;
  url?: string;
  error?: string;
}

const createErrorResponse = (statusCode: number, error: string): UploadFileResponse => ({
  statusCode,
  headers: {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  },
  body: JSON.stringify({ success: false, error }),
});

export const handler: Handler = async (event: HandlerEvent, context: HandlerContext) => {
  // CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
      },
      body: '',
    };
  }

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({ success: false, error: 'Method not allowed' } as UploadFileResponse),
    };
  }

  try {
    // Парсим multipart/form-data
    // В реальной реализации нужно использовать библиотеку для парсинга multipart
    // Например, multiparty или busboy
    const body = event.body || '';
    const contentType = event.headers['content-type'] || '';

    if (!contentType.includes('multipart/form-data')) {
      return {
        statusCode: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
        body: JSON.stringify({
          success: false,
          error: 'Content-Type must be multipart/form-data',
        } as UploadFileResponse),
      };
    }

    // TODO: Реализовать парсинг multipart/form-data
    // Для этого нужно использовать библиотеку типа busboy или multiparty
    // Пример:
    // const formData = await parseMultipartFormData(event);
    // const file = formData.file;
    // const userId = formData.userId;
    // const category = formData.category;
    // const fileName = formData.fileName || file.name;

    // Временная заглушка - в реальной реализации нужно парсить multipart
    const { userId, category, fileName } = JSON.parse(body) as Partial<UploadFileRequest>;

    if (!category) {
      return {
        statusCode: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
        body: JSON.stringify({
          success: false,
          error: 'Category is required',
        } as UploadFileResponse),
      };
    }

    // В реальной реализации здесь будет:
    // 1. Парсинг multipart/form-data
    // 2. Получение файла из формы
    // 3. Загрузка в Supabase Storage
    // 4. Возврат публичного URL

    return {
      statusCode: 501,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({
        success: false,
        error: 'File upload not yet implemented. Need to add multipart/form-data parser.',
      } as UploadFileResponse),
    };
  } catch (error) {
    console.error('Error in upload-file function:', error);
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error',
      } as UploadFileResponse),
    };
  }
};
