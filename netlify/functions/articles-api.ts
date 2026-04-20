/**
 * Netlify Function для работы со статьями пользователей
 *
 * GET /api/articles-api?lang=ru - получить статьи (публичные или пользователя)
 * POST /api/articles-api - создать статью
 * PUT /api/articles-api?id=UUID - обновить статью
 * DELETE /api/articles-api?id=UUID - удалить статью
 */

import type { Handler, HandlerEvent } from '@netlify/functions';
import { query } from './lib/db';
import {
  createOptionsResponse,
  createErrorResponse,
  createSuccessResponse,
  createSuccessMessageResponse,
  validateLang,
  getUserIdFromEvent,
  requireAuth,
  parseJsonBody,
  handleError,
} from './lib/api-helpers';
import type { ApiResponse, SupportedLang } from './lib/types';
import { PublicArtistResolverError, resolvePublicArtistUserId } from './lib/public-artist-resolver';
import type { SupabaseClient } from '@supabase/supabase-js';
import { extractBaseName } from './lib/image-processor';
import { createSupabaseAdminClient, STORAGE_BUCKET_NAME } from './lib/supabase';
import { hydrateMissingRuTranslationsOnArticle } from '../../src/entities/article/lib/hydrateMissingRuTranslations';

interface ArticleRow {
  id: string;
  user_id: string;
  article_id: string;
  name_article: string;
  description: string;
  img: string;
  date: Date;
  details: unknown[];
  lang: string;
  is_draft: boolean;
  created_at: Date;
  updated_at: Date;
}

interface ArticleLocalePayload {
  nameArticle: string;
  description: string;
  details: unknown[];
}

interface ArticleData {
  id: string; // UUID из БД (самая свежая строка по updated_at среди локалей)
  userId?: string;
  articleId: string; // строковый идентификатор (article_id)
  nameArticle: string;
  img: string;
  date: string;
  details: unknown[];
  description: string;
  isDraft?: boolean;
  /** Внутренняя метка для merge по свежести строки (не язык). */
  updatedAt?: string;
  /** Присутствует у одноязычного ответа (POST и т.д.). */
  lang?: string;
  translations?: Partial<Record<SupportedLang, ArticleLocalePayload>>;
}

/** Переводимые поля — только внутри translations[lang]. */
interface CreateArticleRequest {
  articleId: string;
  translations: Partial<Record<SupportedLang, ArticleLocalePayload>>;
  img?: string;
  date: string;
  lang: SupportedLang;
  isDraft?: boolean;
}

interface UpdateArticleRequest {
  articleId: string;
  lang: SupportedLang;
  translations?: Partial<Record<SupportedLang, Partial<ArticleLocalePayload>>>;
  img?: string;
  date?: string;
  isDraft?: boolean;
}

const LEGACY_ARTICLE_TRANSLATABLE_ROOT = ['nameArticle', 'description', 'details'] as const;

function articleRequestHasForbiddenRootFields(body: Record<string, unknown>): string | null {
  for (const key of LEGACY_ARTICLE_TRANSLATABLE_ROOT) {
    if (Object.prototype.hasOwnProperty.call(body, key) && body[key] !== undefined) {
      return `"${key}" must be sent only inside translations[lang], not at request root`;
    }
  }
  return null;
}

type ArticlesResponse = ApiResponse<ArticleData[]>;

function sortArticleRowsForMerge(rows: ArticleRow[]): ArticleRow[] {
  const rank = (l: string) => (l === 'ru' ? 0 : l === 'en' ? 1 : 2);
  return [...rows].sort(
    (a, b) =>
      rank(a.lang) - rank(b.lang) ||
      new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
  );
}

function mergeArticleDataPayloads(payloads: ArticleData[]): ArticleData {
  if (payloads.length === 0) {
    throw new Error('mergeArticleDataPayloads: empty payloads');
  }
  const sortedForShared = [...payloads].sort((a, b) => {
    const ta = a.updatedAt ? new Date(a.updatedAt).getTime() : 0;
    const tb = b.updatedAt ? new Date(b.updatedAt).getTime() : 0;
    return tb - ta;
  });
  const shared = sortedForShared[0];
  const sortedForText = [...payloads].sort((a, b) => {
    const rank = (l: string | undefined) => (l === 'ru' ? 0 : l === 'en' ? 1 : 2);
    return rank(a.lang) - rank(b.lang);
  });
  const textRoot = sortedForText[0] ?? shared;
  const translations: Partial<Record<SupportedLang, ArticleLocalePayload>> = {};
  for (const p of sortedForText) {
    if (p.lang && validateLang(p.lang)) {
      translations[p.lang] = {
        nameArticle: p.nameArticle,
        description: p.description,
        details: p.details,
      };
    }
  }
  return {
    userId: shared.userId,
    articleId: shared.articleId,
    id: shared.id,
    nameArticle: textRoot.nameArticle,
    description: textRoot.description,
    img: shared.img,
    date: shared.date,
    details: textRoot.details,
    isDraft: shared.isDraft,
    translations,
    updatedAt: shared.updatedAt,
  };
}

async function syncSharedArticleMetadataAcrossLocales(
  userId: string,
  articleId: string,
  patch: {
    img?: string | null;
    date?: string;
    isDraft?: boolean;
  }
): Promise<void> {
  const sets: string[] = [];
  const values: unknown[] = [];
  let i = 1;
  if (patch.img !== undefined) {
    sets.push(`img = $${i++}`);
    values.push(patch.img);
  }
  if (patch.date !== undefined) {
    sets.push(`date = $${i++}::date`);
    values.push(patch.date);
  }
  if (patch.isDraft !== undefined) {
    sets.push(`is_draft = $${i++}`);
    values.push(patch.isDraft);
  }
  if (sets.length === 0) return;
  sets.push('updated_at = CURRENT_TIMESTAMP');
  values.push(userId, articleId);
  await query(
    `UPDATE articles SET ${sets.join(', ')} WHERE user_id = $${i++}::uuid AND article_id = $${i++}`,
    values
  );
}

function mergeArticleRowsToApiData(rows: ArticleRow[]): ArticleData {
  const sorted = sortArticleRowsForMerge(rows);
  const payloads = sorted.map(mapArticleToApiFormat);
  const merged = mergeArticleDataPayloads(payloads);
  return hydrateMissingRuTranslationsOnArticle(
    merged as import('../../src/models').IArticles
  ) as ArticleData;
}

/**
 * Преобразует данные статьи из БД в формат API
 */
function mapArticleToApiFormat(article: ArticleRow): ArticleData {
  // Парсим details, если это строка (JSONB из базы может приходить как строка)
  let details = article.details;
  if (typeof details === 'string') {
    try {
      details = JSON.parse(details);
    } catch (e) {
      console.error('[mapArticleToApiFormat] Error parsing details:', e);
      details = [];
    }
  }

  const result: ArticleData = {
    id: article.id, // UUID из БД
    userId: article.user_id || undefined,
    articleId: article.article_id, // строковый идентификатор
    nameArticle: article.name_article,
    img: article.img || '',
    date: article.date.toISOString().split('T')[0], // YYYY-MM-DD
    details: (details as unknown[]) || [],
    description: article.description || '',
    isDraft: article.is_draft ?? false, // Статус черновика
    lang: article.lang,
    updatedAt:
      article.updated_at != null ? new Date(article.updated_at as Date).toISOString() : undefined,
  };

  console.log('[mapArticleToApiFormat] Mapped article:', {
    articleId: result.articleId,
    nameArticle: result.nameArticle,
    detailsType: typeof article.details,
    detailsLength: Array.isArray(result.details) ? result.details.length : 'not array',
    firstDetail:
      Array.isArray(result.details) && result.details.length > 0 ? result.details[0] : null,
  });

  return result;
}

function parseDetailsArray(details: unknown): unknown[] {
  if (details == null) return [];
  if (typeof details === 'string') {
    try {
      const parsed = JSON.parse(details);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return Array.isArray(details) ? details : [];
}

const INVALID_ARTICLE_STEMS = new Set(['', 'proxy-image']);

/**
 * Достаёт путь вида users/.../... из полного URL, proxy (?path=) или уже готовой строки.
 */
function tryParseUsersStoragePath(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith('users/')) {
    return trimmed.split('?')[0];
  }
  try {
    const u =
      trimmed.startsWith('http://') || trimmed.startsWith('https://')
        ? new URL(trimmed)
        : new URL(trimmed, 'https://article-delete.local');
    const pathParam = u.searchParams.get('path');
    if (pathParam) {
      const dec = pathParam.trim();
      if (dec.startsWith('users/')) return dec.split('?')[0];
    }
    const p = decodeURIComponent(u.pathname);
    const idx = p.indexOf('/users/');
    if (idx !== -1) {
      return p.slice(idx + 1).split('?')[0];
    }
  } catch {
    /* не URL */
  }
  return null;
}

function stemFromPlainFileRef(raw: string): string | null {
  const s = raw.trim();
  if (!s || INVALID_ARTICLE_STEMS.has(s)) return null;
  const last = s.includes('/') ? (s.split('/').pop() ?? s) : s;
  const base = extractBaseName(last);
  if (!base || INVALID_ARTICLE_STEMS.has(base)) return null;
  return base;
}

interface ArticleMediaDeletionTargets {
  stems: string[];
  storagePaths: string[];
}

function addRawToArticleMediaTargets(
  stems: Set<string>,
  storagePathsOut: Set<string>,
  ownerUserId: string,
  raw: unknown
): void {
  if (raw == null) return;
  if (Array.isArray(raw)) {
    for (const x of raw) addRawToArticleMediaTargets(stems, storagePathsOut, ownerUserId, x);
    return;
  }
  const s = String(raw).trim();
  if (!s) return;

  const ownerArticlesPrefix = `users/${ownerUserId}/articles/`;
  const parsedPath = tryParseUsersStoragePath(s);

  if (parsedPath) {
    if (parsedPath.startsWith(ownerArticlesPrefix)) {
      storagePathsOut.add(parsedPath);
      const file = parsedPath.split('/').pop() || '';
      const st = extractBaseName(file);
      if (st && !INVALID_ARTICLE_STEMS.has(st)) stems.add(st);
      return;
    }
    if (parsedPath.startsWith('users/')) {
      return;
    }
  }

  const st = stemFromPlainFileRef(s);
  if (st) stems.add(st);
}

function collectArticleMediaDeletionTargets(
  img: string | null | undefined,
  details: unknown,
  ownerUserId: string
): ArticleMediaDeletionTargets {
  const stems = new Set<string>();
  const storagePathsOut = new Set<string>();
  addRawToArticleMediaTargets(stems, storagePathsOut, ownerUserId, img);
  for (const item of parseDetailsArray(details)) {
    if (!item || typeof item !== 'object') continue;
    const d = item as Record<string, unknown>;
    if (d.type === 'image') {
      addRawToArticleMediaTargets(stems, storagePathsOut, ownerUserId, d.img);
    } else if (d.type === 'carousel') {
      if (Array.isArray(d.images))
        addRawToArticleMediaTargets(stems, storagePathsOut, ownerUserId, d.images);
      addRawToArticleMediaTargets(stems, storagePathsOut, ownerUserId, d.img);
    }
    if (typeof d.imageKey === 'string') {
      addRawToArticleMediaTargets(stems, storagePathsOut, ownerUserId, d.imageKey);
    }
    if (Array.isArray(d.imageKeys)) {
      addRawToArticleMediaTargets(stems, storagePathsOut, ownerUserId, d.imageKeys);
    }
  }
  return { stems: [...stems], storagePaths: [...storagePathsOut] };
}

async function listAllArticleFolderFiles(
  supabase: SupabaseClient,
  folder: string
): Promise<{ name: string; id: string | null }[]> {
  const pageSize = 1000;
  const all: { name: string; id: string | null }[] = [];
  for (let offset = 0; ; offset += pageSize) {
    const { data, error } = await supabase.storage.from(STORAGE_BUCKET_NAME).list(folder, {
      limit: pageSize,
      offset,
      sortBy: { column: 'name', order: 'asc' },
    });
    if (error) {
      console.error('[articles-api DELETE] Storage list failed:', error.message);
      throw error;
    }
    if (!data?.length) break;
    all.push(...data);
    if (data.length < pageSize) break;
  }
  return all;
}

async function removeArticleStorageFiles(
  supabase: SupabaseClient,
  userId: string,
  targets: ArticleMediaDeletionTargets
): Promise<void> {
  const { stems, storagePaths } = targets;
  if (stems.length === 0 && storagePaths.length === 0) return;

  const pathSet = new Set<string>(storagePaths);
  const stemSet = new Set(stems);
  const folder = `users/${userId}/articles`;
  const ownerPrefix = `users/${userId}/articles/`;

  if (stemSet.size > 0) {
    try {
      const existingFiles = await listAllArticleFolderFiles(supabase, folder);
      for (const f of existingFiles) {
        if (!f.name || f.id == null) continue;
        if (stemSet.has(extractBaseName(f.name))) {
          pathSet.add(`${folder}/${f.name}`);
        }
      }
    } catch {
      /* ошибка уже залогирована */
    }
  }

  const paths = [...pathSet].filter((p) => p.startsWith(ownerPrefix));
  if (paths.length === 0) return;

  const chunkSize = 100;
  for (let i = 0; i < paths.length; i += chunkSize) {
    const batch = paths.slice(i, i + chunkSize);
    const { error: deleteError } = await supabase.storage.from(STORAGE_BUCKET_NAME).remove(batch);
    if (deleteError) {
      console.error('[articles-api DELETE] Storage remove failed:', deleteError.message, batch);
    }
  }
}

/**
 * Точные ключи в bucket для старой обложки статьи (без list/stem — как в upload-file).
 * В БД часто лежит только имя файла; в Storage объект: users/{userId}/articles/{fileName}.
 */
function storagePathsToRemoveForArticleCoverImg(
  raw: string | null | undefined,
  ownerUserId: string
): string[] {
  if (raw == null) return [];
  const s = String(raw).trim();
  if (!s) return [];

  const ownerPrefix = `users/${ownerUserId}/articles/`;
  const parsed = tryParseUsersStoragePath(s);
  if (parsed) {
    if (parsed.startsWith(ownerPrefix)) {
      return [parsed];
    }
    return [];
  }

  const fileName = s.includes('/') ? (s.split('/').pop() ?? s) : s;
  const base = fileName.trim();
  if (!base || INVALID_ARTICLE_STEMS.has(base)) return [];
  return [`${ownerPrefix}${base}`];
}

async function removeStorageObjectsExact(supabase: SupabaseClient, paths: string[]): Promise<void> {
  const uniq = [...new Set(paths)].filter(Boolean);
  if (uniq.length === 0) return;
  const chunkSize = 100;
  for (let i = 0; i < uniq.length; i += chunkSize) {
    const batch = uniq.slice(i, i + chunkSize);
    const { error } = await supabase.storage.from(STORAGE_BUCKET_NAME).remove(batch);
    if (error) {
      console.error('[articles-api] Storage remove (exact paths) failed:', error.message, batch);
    }
  }
}

export const handler: Handler = async (
  event: HandlerEvent
): Promise<{ statusCode: number; headers: Record<string, string>; body: string }> => {
  if (event.httpMethod === 'OPTIONS') {
    return createOptionsResponse();
  }

  try {
    // Для GET запросов авторизация не требуется - все статьи публичные
    // Для POST/PUT/DELETE требуется авторизация (админка)
    // Для GET с includeDrafts=true также требуется авторизация
    const includeDrafts =
      event.httpMethod === 'GET' && event.queryStringParameters?.includeDrafts === 'true';
    const userId =
      event.httpMethod === 'GET'
        ? includeDrafts
          ? getUserIdFromEvent(event)
          : null
        : getUserIdFromEvent(event);

    if (event.httpMethod === 'GET') {
      const { lang: langQuery, id } = event.queryStringParameters || {};
      // `lang` в query больше не фильтрует ответ; оставлен для обратной совместимости клиентов.
      if (langQuery && !validateLang(langQuery)) {
        return createErrorResponse(400, 'Invalid lang parameter. Must be "en" or "ru".');
      }

      if (includeDrafts) {
        console.log('[articles-api] GET with includeDrafts:', {
          includeDrafts,
          hasUserId: !!userId,
          userId,
          hasAuthHeader: !!(event.headers?.authorization || event.headers?.Authorization),
        });
      }
      if (includeDrafts && !userId) {
        return createErrorResponse(401, 'Unauthorized. Authentication required to view drafts.');
      }

      if (!includeDrafts) {
        const artistSlug = event.queryStringParameters?.artist?.trim();
        if (!artistSlug) {
          return createErrorResponse(400, 'Missing required query parameter: artist');
        }
      }

      const ARTICLE_ROW_SELECT = `
              id,
              user_id,
              article_id,
              name_article,
              description,
              img,
              date,
              details,
              lang,
              is_draft,
              created_at,
              updated_at`;

      // GET по id (UUID или article_id): слив всех локалей в одну сущность.
      if (id) {
        let targetUserId: string;
        if (includeDrafts) {
          if (!userId) {
            return createErrorResponse(
              401,
              'Unauthorized. Authentication required to view drafts.'
            );
          }
          targetUserId = userId;
        } else {
          const artistSlug = event.queryStringParameters?.artist;
          try {
            targetUserId = await resolvePublicArtistUserId(artistSlug);
          } catch (error) {
            if (error instanceof PublicArtistResolverError) {
              return createErrorResponse(error.statusCode, error.message);
            }
            throw error;
          }
        }

        const locate = await query<{ article_id: string }>(
          `SELECT article_id FROM articles
           WHERE user_id = $1::uuid AND (id::text = $2 OR article_id = $2)
           LIMIT 1`,
          [targetUserId, id]
        );

        if (locate.rows.length === 0) {
          return createSuccessResponse([]);
        }

        const articleId = locate.rows[0].article_id;
        const draftClause = includeDrafts ? '' : 'AND (is_draft = false OR is_draft IS NULL)';

        const articleResult = await query<ArticleRow>(
          `SELECT ${ARTICLE_ROW_SELECT}
            FROM articles
            WHERE user_id = $1::uuid AND article_id = $2 ${draftClause}
            ORDER BY CASE lang WHEN 'ru' THEN 0 WHEN 'en' THEN 1 ELSE 2 END,
              updated_at DESC`,
          [targetUserId, articleId]
        );

        if (articleResult.rows.length === 0) {
          return createSuccessResponse([]);
        }

        return createSuccessResponse([mergeArticleRowsToApiData(articleResult.rows)]);
      }

      let targetUserId: string;
      if (includeDrafts) {
        if (!userId) {
          return createErrorResponse(401, 'Unauthorized. Authentication required to view drafts.');
        }
        targetUserId = userId;
      } else {
        const artistSlug = event.queryStringParameters?.artist;
        try {
          targetUserId = await resolvePublicArtistUserId(artistSlug);
        } catch (error) {
          if (error instanceof PublicArtistResolverError) {
            return createErrorResponse(error.statusCode, error.message);
          }
          throw error;
        }
      }

      const draftClause = includeDrafts ? '' : 'AND (is_draft = false OR is_draft IS NULL)';

      const articlesResult = await query<ArticleRow>(
        `SELECT ${ARTICLE_ROW_SELECT}
          FROM articles
          WHERE user_id = $1::uuid ${draftClause}
          ORDER BY article_id,
            CASE lang WHEN 'ru' THEN 0 WHEN 'en' THEN 1 ELSE 2 END,
            updated_at DESC`,
        [targetUserId]
      );

      const byArticleId = new Map<string, ArticleRow[]>();
      const articleIdsOrdered: string[] = [];
      for (const row of articlesResult.rows) {
        if (!byArticleId.has(row.article_id)) {
          articleIdsOrdered.push(row.article_id);
          byArticleId.set(row.article_id, []);
        }
        byArticleId.get(row.article_id)!.push(row);
      }

      const merged = articleIdsOrdered.map((aid) =>
        mergeArticleRowsToApiData(byArticleId.get(aid)!)
      );

      return createSuccessResponse(merged);
    }

    if (event.httpMethod === 'POST') {
      if (!userId) {
        return createErrorResponse(401, 'Unauthorized');
      }

      let data: CreateArticleRequest;
      try {
        data = parseJsonBody<CreateArticleRequest>(event.body, {} as CreateArticleRequest);
      } catch (error) {
        return createErrorResponse(
          400,
          error instanceof Error ? error.message : 'Invalid JSON body'
        );
      }

      const forbidden = articleRequestHasForbiddenRootFields(
        data as unknown as Record<string, unknown>
      );
      if (forbidden) {
        return createErrorResponse(400, forbidden);
      }

      const locale = data.translations?.[data.lang];
      if (
        !data.articleId ||
        !data.date ||
        !data.lang ||
        !validateLang(data.lang) ||
        !locale ||
        !locale.nameArticle ||
        !Array.isArray(locale.details)
      ) {
        return createErrorResponse(
          400,
          'Invalid request data. Required: articleId, date, lang, translations[lang] with nameArticle and details'
        );
      }

      const isDraft = data.isDraft !== undefined ? data.isDraft : true;

      const result = await query<ArticleRow>(
        `INSERT INTO articles (user_id, article_id, name_article, description, img, date, details, lang, is_draft, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8, $9, NOW(), NOW())
         ON CONFLICT (user_id, article_id, lang)
         DO UPDATE SET
           name_article = EXCLUDED.name_article,
           description = EXCLUDED.description,
           img = EXCLUDED.img,
           date = EXCLUDED.date,
           details = EXCLUDED.details,
           is_draft = EXCLUDED.is_draft,
           updated_at = CURRENT_TIMESTAMP
         RETURNING id, user_id, article_id, name_article, description, img, date, details, lang, is_draft, created_at, updated_at`,
        [
          userId,
          data.articleId,
          locale.nameArticle,
          locale.description ?? null,
          data.img || null,
          data.date,
          JSON.stringify(locale.details),
          data.lang,
          isDraft,
        ]
      );

      await syncSharedArticleMetadataAcrossLocales(userId, data.articleId, {
        img: data.img !== undefined ? data.img : undefined,
        date: data.date,
        isDraft,
      });

      if (result.rows.length > 0) {
        return createSuccessResponse([mapArticleToApiFormat(result.rows[0])]);
      }

      return createSuccessMessageResponse('Article created successfully', 201);
    }

    if (event.httpMethod === 'PUT') {
      console.log('[articles-api PUT] Request received', {
        hasUserId: !!userId,
        userId: userId?.substring(0, 10) + '...',
        queryParams: event.queryStringParameters,
      });

      if (!userId) {
        console.log('[articles-api PUT] Unauthorized: no userId');
        return createErrorResponse(401, 'Unauthorized');
      }

      const { id } = event.queryStringParameters || {};

      if (!id) {
        console.log('[articles-api PUT] Bad request: no id in query params');
        return createErrorResponse(400, 'Article ID is required (query parameter: id)');
      }

      let data: UpdateArticleRequest;
      try {
        data = parseJsonBody<UpdateArticleRequest>(event.body, {} as UpdateArticleRequest);
      } catch (error) {
        return createErrorResponse(
          400,
          error instanceof Error ? error.message : 'Invalid JSON body'
        );
      }

      const forbidden = articleRequestHasForbiddenRootFields(
        data as unknown as Record<string, unknown>
      );
      if (forbidden) {
        return createErrorResponse(400, forbidden);
      }

      if (!data.articleId || !data.lang || !validateLang(data.lang)) {
        return createErrorResponse(
          400,
          'Invalid request data. Required: articleId, lang (must be "en" or "ru")'
        );
      }

      const checkResult = await query<{ article_id: string }>(
        `SELECT article_id FROM articles
         WHERE (id::text = $1 OR article_id = $1) AND user_id = $2::uuid`,
        [id, userId]
      );

      if (checkResult.rows.length === 0) {
        return createErrorResponse(404, 'Article not found or access denied');
      }

      const resolvedArticleId = checkResult.rows[0].article_id;
      if (resolvedArticleId !== data.articleId) {
        return createErrorResponse(400, 'articleId in body does not match article');
      }

      const previousImgRow = await query<{ img: string | null }>(
        `SELECT img FROM articles
         WHERE user_id = $1::uuid AND article_id = $2
         ORDER BY updated_at DESC NULLS LAST
         LIMIT 1`,
        [userId, resolvedArticleId]
      );
      const previousImg = previousImgRow.rows[0]?.img ?? null;

      const patch = data.translations?.[data.lang];
      const existingLocale = await query<ArticleRow>(
        `SELECT id, user_id, article_id, name_article, description, img, date, details, lang, is_draft, created_at, updated_at
         FROM articles
         WHERE user_id = $1::uuid AND article_id = $2 AND lang = $3`,
        [userId, resolvedArticleId, data.lang]
      );

      const hasLocalePatch =
        patch &&
        (patch.nameArticle !== undefined ||
          patch.description !== undefined ||
          patch.details !== undefined);

      const hasSharedPatch =
        data.img !== undefined || data.date !== undefined || data.isDraft !== undefined;

      if (!hasLocalePatch && !hasSharedPatch) {
        return createErrorResponse(400, 'No fields to update');
      }

      if (hasLocalePatch) {
        const cur = existingLocale.rows[0];
        const nameArticle = patch!.nameArticle ?? cur?.name_article ?? '';
        const description = patch!.description ?? cur?.description ?? '';
        const detailsArr = patch!.details ?? parseDetailsArray(cur?.details);
        const imgVal = data.img !== undefined ? data.img : (cur?.img ?? null);
        let dateVal: string;
        if (data.date !== undefined) {
          dateVal = data.date;
        } else if (cur?.date) {
          const d = cur.date as Date;
          dateVal = d.toISOString().split('T')[0];
        } else {
          dateVal = new Date().toISOString().split('T')[0];
        }
        const isDraftVal = data.isDraft !== undefined ? data.isDraft : (cur?.is_draft ?? true);

        if (!nameArticle || !Array.isArray(detailsArr)) {
          return createErrorResponse(
            400,
            'translations[lang] must include nameArticle and details when updating locale fields'
          );
        }

        await query<ArticleRow>(
          `INSERT INTO articles (user_id, article_id, name_article, description, img, date, details, lang, is_draft, created_at, updated_at)
           VALUES ($1::uuid, $2, $3, $4, $5, $6, $7::jsonb, $8, $9, NOW(), NOW())
           ON CONFLICT (user_id, article_id, lang)
           DO UPDATE SET
             name_article = EXCLUDED.name_article,
             description = EXCLUDED.description,
             img = EXCLUDED.img,
             date = EXCLUDED.date,
             details = EXCLUDED.details,
             is_draft = EXCLUDED.is_draft,
             updated_at = CURRENT_TIMESTAMP
           RETURNING id`,
          [
            userId,
            resolvedArticleId,
            nameArticle,
            description || null,
            imgVal,
            dateVal,
            JSON.stringify(detailsArr),
            data.lang,
            isDraftVal,
          ]
        );

        await syncSharedArticleMetadataAcrossLocales(userId, resolvedArticleId, {
          img: imgVal ?? undefined,
          date: dateVal,
          isDraft: isDraftVal,
        });
      } else if (hasSharedPatch) {
        await syncSharedArticleMetadataAcrossLocales(userId, resolvedArticleId, {
          img: data.img !== undefined ? data.img : undefined,
          date: data.date !== undefined ? data.date : undefined,
          isDraft: data.isDraft !== undefined ? data.isDraft : undefined,
        });
      }

      if (data.img !== undefined) {
        const prev = String(previousImg ?? '').trim();
        const next = String(data.img).trim();
        if (prev && prev !== next) {
          const supabaseAdmin = createSupabaseAdminClient();
          if (supabaseAdmin) {
            try {
              const pathsToRemove = storagePathsToRemoveForArticleCoverImg(prev, userId);
              if (pathsToRemove.length > 0) {
                console.log('[articles-api PUT] Removing previous article cover from storage:', {
                  previousImg: prev,
                  pathsToRemove,
                });
                await removeStorageObjectsExact(supabaseAdmin, pathsToRemove);
              } else {
                console.warn(
                  '[articles-api PUT] Could not resolve storage path for previous cover:',
                  prev
                );
              }
            } catch (cleanupErr) {
              console.error(
                '[articles-api PUT] Previous cover image storage cleanup failed:',
                cleanupErr
              );
            }
          } else {
            console.warn(
              '[articles-api PUT] Supabase admin client missing; skipped previous cover removal'
            );
          }
        }
      }

      return createSuccessMessageResponse('Article updated successfully');
    }

    if (event.httpMethod === 'DELETE') {
      if (!userId) {
        return createErrorResponse(401, 'Unauthorized');
      }

      const { id } = event.queryStringParameters || {};

      if (!id) {
        return createErrorResponse(400, 'Article ID is required (query parameter: id)');
      }

      // Валидация UUID
      const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
      if (!UUID_RE.test(id)) {
        return createErrorResponse(400, `Invalid id. Expected UUID, got "${id}"`);
      }

      const locateDelete = await query<{ article_id: string }>(
        `SELECT article_id FROM articles WHERE id = $1 AND user_id = $2::uuid`,
        [id, userId]
      );

      if (locateDelete.rows.length === 0) {
        return createErrorResponse(404, 'Article not found or access denied');
      }

      const articleIdToDelete = locateDelete.rows[0].article_id;

      const rowsForMedia = await query<{ img: string | null; details: unknown }>(
        `SELECT img, details FROM articles WHERE user_id = $1::uuid AND article_id = $2`,
        [userId, articleIdToDelete]
      );

      const stems = new Set<string>();
      const storagePaths = new Set<string>();
      for (const r of rowsForMedia.rows) {
        const t = collectArticleMediaDeletionTargets(r.img ?? '', r.details, userId);
        for (const s of t.stems) stems.add(s);
        for (const p of t.storagePaths) storagePaths.add(p);
      }
      const mediaTargets: ArticleMediaDeletionTargets = {
        stems: [...stems],
        storagePaths: [...storagePaths],
      };

      if (mediaTargets.stems.length > 0 || mediaTargets.storagePaths.length > 0) {
        const supabase = createSupabaseAdminClient();
        if (supabase) {
          await removeArticleStorageFiles(supabase, userId, mediaTargets);
        } else {
          console.warn(
            '[articles-api DELETE] Supabase admin client missing; skipped storage cleanup'
          );
        }
      }

      await query(`DELETE FROM articles WHERE user_id = $1::uuid AND article_id = $2`, [
        userId,
        articleIdToDelete,
      ]);

      return createSuccessMessageResponse('Article deleted successfully');
    }

    return createErrorResponse(405, 'Method not allowed');
  } catch (error) {
    return handleError(error, 'articles-api function');
  }
};
