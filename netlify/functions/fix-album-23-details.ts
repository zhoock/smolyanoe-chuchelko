/**
 * Netlify Function для исправления данных альбома "23"
 * Удаляет пользовательские записи с пустыми details
 */

import type { Handler, HandlerEvent } from '@netlify/functions';
import { query } from './lib/db';
import {
  createOptionsResponse,
  createErrorResponse,
  createSuccessResponse,
  CORS_HEADERS,
} from './lib/api-helpers';

export const handler: Handler = async (event: HandlerEvent) => {
  const headers = {
    ...CORS_HEADERS,
    'Content-Type': 'application/json',
  };

  if (event.httpMethod === 'OPTIONS') {
    return createOptionsResponse();
  }

  // Только POST запросы
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ success: false, error: 'Method not allowed. Use POST.' }),
    };
  }

  try {
    console.log('🔍 Проверяем записи альбома "23" в базе данных...');

    // Проверяем все записи для альбома "23"
    const checkResult = await query(
      `SELECT id, user_id, album_id, lang, 
              CASE 
                WHEN details IS NULL THEN 0
                WHEN jsonb_typeof(details) = 'array' THEN jsonb_array_length(details)
                ELSE 0
              END as details_count,
              created_at, updated_at
       FROM albums 
       WHERE album_id = '23'
       ORDER BY lang, user_id NULLS LAST, created_at DESC`
    );

    console.log(`📊 Найдено записей для альбома "23": ${checkResult.rows.length}`);

    const recordsInfo = checkResult.rows.map((row) => ({
      lang: row.lang,
      userId: row.user_id || null,
      detailsCount: row.details_count,
      updatedAt: row.updated_at,
    }));

    // Удаляем пользовательские записи с пустыми или отсутствующими details
    console.log('🗑️  Удаляем пользовательские записи с пустыми details...');

    const deleteResult = await query(
      `DELETE FROM albums 
       WHERE album_id = '23' 
         AND user_id IS NOT NULL
         AND (
           details IS NULL 
           OR jsonb_typeof(details) != 'array'
           OR jsonb_array_length(details) = 0
         )
       RETURNING id, lang, user_id`
    );

    console.log(`✅ Удалено пользовательских записей: ${deleteResult.rows.length}`);

    const deletedRecords = deleteResult.rows.map((row) => ({
      lang: row.lang,
      userId: row.user_id,
    }));

    // Проверяем оставшиеся записи
    const remainingResult = await query(
      `SELECT id, user_id, album_id, lang, 
              CASE 
                WHEN details IS NULL THEN 0
                WHEN jsonb_typeof(details) = 'array' THEN jsonb_array_length(details)
                ELSE 0
              END as details_count
       FROM albums 
       WHERE album_id = '23'
       ORDER BY lang, user_id NULLS LAST`
    );

    const remainingRecords = remainingResult.rows.map((row) => ({
      lang: row.lang,
      userId: row.user_id || null,
      detailsCount: row.details_count,
    }));

    return createSuccessResponse({
      success: true,
      message: 'User records with empty details deleted',
      before: {
        totalRecords: checkResult.rows.length,
        records: recordsInfo,
      },
      deleted: {
        count: deleteResult.rows.length,
        records: deletedRecords,
      },
      remaining: {
        count: remainingResult.rows.length,
        records: remainingRecords,
      },
    });
  } catch (error) {
    console.error('❌ Ошибка при исправлении:', error);
    return createErrorResponse(500, error instanceof Error ? error.message : 'Unknown error');
  }
};
