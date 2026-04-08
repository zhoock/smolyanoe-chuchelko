/**
 * GET /api/health/genres
 * Сверяет коды в таблице `genres` с CANONICAL_GENRE_CODES (canonicalGenres.ts).
 */

import type { Handler, HandlerEvent } from '@netlify/functions';
import { CANONICAL_GENRE_CODES } from '../../src/shared/constants/canonicalGenres';
import { query } from './lib/db';
import { createErrorResponse, createOptionsResponse, CORS_HEADERS } from './lib/api-helpers';

interface Row {
  code: string;
}

export const handler: Handler = async (
  event: HandlerEvent
): Promise<{ statusCode: number; headers: Record<string, string>; body: string }> => {
  if (event.httpMethod === 'OPTIONS') {
    return createOptionsResponse();
  }

  if (event.httpMethod !== 'GET') {
    return createErrorResponse(405, 'Method not allowed');
  }

  try {
    const result = await query<Row>(`SELECT code FROM genres ORDER BY code`, [], 0);

    // Нормализация как при записи в API (trim + lower), иначе «Grunge» / « grunge » дают ложный mismatch.
    const dbCodes = result.rows.map((r) =>
      String(r.code ?? '')
        .trim()
        .toLowerCase()
    );
    const dbSet = new Set(dbCodes);
    const dbCodesUnique = [...dbSet].sort();
    const canonicalSorted = [...CANONICAL_GENRE_CODES].sort();

    const canonicalSet = new Set(canonicalSorted);

    const onlyInCanonical = canonicalSorted.filter((c) => !dbSet.has(c));
    const onlyInDatabase = dbCodesUnique.filter((c) => !canonicalSet.has(c));

    const noDuplicateRows = dbCodes.length === dbSet.size;
    const match =
      noDuplicateRows &&
      onlyInCanonical.length === 0 &&
      onlyInDatabase.length === 0 &&
      canonicalSet.size === dbSet.size;

    const body = JSON.stringify({
      success: true,
      match,
      canonical: canonicalSorted,
      database: dbCodesUnique,
      onlyInCanonical,
      onlyInDatabase,
    });

    return {
      statusCode: match ? 200 : 503,
      headers: CORS_HEADERS,
      body,
    };
  } catch (error) {
    console.error('[health-genres]', error);
    return {
      statusCode: 500,
      headers: CORS_HEADERS,
      body: JSON.stringify({
        success: false,
        match: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }),
    };
  }
};
