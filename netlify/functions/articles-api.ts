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
  getUsernameFromEvent,
  requireAuth,
  parseJsonBody,
  handleError,
} from './lib/api-helpers';
import { getUserByUsername } from './lib/username-helpers';
import type { ApiResponse, SupportedLang } from './lib/types';

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

interface ArticleData {
  id: string; // UUID из БД
  userId: string; // UUID владельца статьи
  articleId: string; // строковый идентификатор (article_id)
  nameArticle: string;
  img: string;
  date: string;
  details: unknown[];
  description: string;
  isDraft?: boolean; // Статус черновика (опционально для обратной совместимости)
}

interface CreateArticleRequest {
  articleId: string;
  nameArticle: string;
  description?: string;
  img?: string;
  date: string;
  details: unknown[];
  lang: SupportedLang;
  isDraft?: boolean;
}

interface UpdateArticleRequest {
  nameArticle?: string;
  description?: string;
  img?: string;
  date?: string;
  details?: unknown[];
  isDraft?: boolean;
}

type ArticlesResponse = ApiResponse<ArticleData[]>;

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

  const result = {
    id: article.id, // UUID из БД
    userId: article.user_id, // UUID владельца статьи
    articleId: article.article_id, // строковый идентификатор
    nameArticle: article.name_article,
    img: article.img || '',
    date: article.date.toISOString().split('T')[0], // YYYY-MM-DD
    details: (details as unknown[]) || [],
    description: article.description || '',
    isDraft: article.is_draft ?? false, // Статус черновика
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

    const username = getUsernameFromEvent(event);
    const usernameOwner = username ? await getUserByUsername(username) : null;

    if (username && !usernameOwner) {
      return createErrorResponse(404, 'User not found');
    }

    const authUserId = getUserIdFromEvent(event);

    if (event.httpMethod === 'GET') {
      const { lang } = event.queryStringParameters || {};

      if (!validateLang(lang)) {
        return createErrorResponse(400, 'Invalid lang parameter. Must be "en" or "ru".');
      }

      if (!usernameOwner) {
        return createErrorResponse(400, 'Username parameter is required.');
      }

      const targetUserId = usernameOwner.id;

      // Проверяем, нужно ли включать черновики (для редактирования в админке, требует авторизации)
      // #region agent log
      if (includeDrafts) {
        console.log('[articles-api] GET with includeDrafts:', {
          includeDrafts,
          hasAuthUserId: !!authUserId,
          authUserId,
          requestedUserId: targetUserId,
          hasAuthHeader: !!(event.headers?.authorization || event.headers?.Authorization),
        });
      } else {
        console.log('[articles-api] GET public articles:', {
          requestedUserId: targetUserId,
          host: event.headers?.host || event.headers?.Host,
        });
      }
      // #endregion
      if (includeDrafts && !authUserId) {
        return createErrorResponse(401, 'Unauthorized. Authentication required to view drafts.');
      }

      if (includeDrafts && authUserId !== targetUserId) {
        return createErrorResponse(403, 'Access denied.');
      }

      // Возвращаем статьи для указанного языка
      // Если userId определен (через поддомен или токен), возвращаем только статьи этого пользователя
      // Иначе возвращаем все опубликованные статьи (для обратной совместимости)
      const articlesResult = await query<ArticleRow>(
        `SELECT DISTINCT ON (article_id)
          id,
          user_id,
          article_id,
          name_article,
          description,
          img,
          date,
          details,
          lang,
          is_draft
        FROM articles
        WHERE lang = $1
          AND user_id = $2
          ${includeDrafts ? '' : 'AND (is_draft = false OR is_draft IS NULL)'}
        ORDER BY article_id, updated_at DESC`,
        [lang, targetUserId]
      );

      const articles = articlesResult.rows.map(mapArticleToApiFormat);

      return createSuccessResponse(articles);
    }

    if (event.httpMethod === 'POST') {
      const userId = requireAuth(event);

      if (!userId) {
        return createErrorResponse(401, 'Unauthorized');
      }

      if (usernameOwner && usernameOwner.id !== userId) {
        return createErrorResponse(403, 'Access denied.');
      }

      const data = parseJsonBody<CreateArticleRequest>(event.body, {} as CreateArticleRequest);

      if (
        !data.articleId ||
        !data.nameArticle ||
        !data.date ||
        !data.lang ||
        !data.details ||
        !validateLang(data.lang)
      ) {
        return createErrorResponse(
          400,
          'Invalid request data. Required: articleId, nameArticle, date, lang (must be "en" or "ru"), details'
        );
      }

      // Используем RETURNING чтобы получить UUID созданной статьи
      // По умолчанию создаем как черновик (is_draft = true), если не указано иное
      const isDraft = data.isDraft !== undefined ? data.isDraft : true;

      const result = await query<ArticleRow>(
        `INSERT INTO articles (user_id, article_id, name_article, description, img, date, details, lang, is_draft, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8, $9, NOW(), NOW())
         RETURNING id, article_id, name_article, description, img, date, details, lang, is_draft`,
        [
          userId,
          data.articleId,
          data.nameArticle,
          data.description || null,
          data.img || null,
          data.date,
          JSON.stringify(data.details),
          data.lang,
          isDraft, // Используем переданное значение или true по умолчанию
        ]
      );

      // Возвращаем созданную статью с UUID
      if (result.rows.length > 0) {
        return createSuccessResponse([mapArticleToApiFormat(result.rows[0])]);
      }

      return createSuccessMessageResponse('Article created successfully', 201);
    }

    if (event.httpMethod === 'PUT') {
      const userId = requireAuth(event);

      console.log('[articles-api PUT] Request received', {
        hasUserId: !!userId,
        userId: userId ? `${userId.substring(0, 10)}...` : null,
        queryParams: event.queryStringParameters,
      });

      if (!userId) {
        console.log('[articles-api PUT] Unauthorized: no userId');
        return createErrorResponse(401, 'Unauthorized');
      }

      if (usernameOwner && usernameOwner.id !== userId) {
        console.log('[articles-api PUT] Access denied: username mismatch', {
          username,
          usernameOwnerId: usernameOwner.id,
          userId,
        });
        return createErrorResponse(403, 'Access denied.');
      }

      const { id } = event.queryStringParameters || {};

      if (!id) {
        console.log('[articles-api PUT] Bad request: no id in query params');
        return createErrorResponse(400, 'Article ID is required (query parameter: id)');
      }

      const data = parseJsonBody<UpdateArticleRequest>(event.body, {} as UpdateArticleRequest);

      // Валидация UUID
      const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
      const isUUID = UUID_RE.test(id);

      console.log('[articles-api PUT] Checking article', {
        id,
        isUUID,
        userId: userId?.substring(0, 10) + '...',
      });

      // Проверяем, что статья принадлежит пользователю
      // Поддерживаем как UUID id, так и article_id для обратной совместимости
      let checkResult: Awaited<ReturnType<typeof query<ArticleRow>>>;

      if (isUUID) {
        // Используем UUID id для поиска
        console.log('[articles-api PUT] Searching by UUID id', { id, userId });
        // Проверяем, что статья существует И (принадлежит пользователю ИЛИ является публичной)
        // Публичные статьи имеют user_id = NULL
        checkResult = await query<ArticleRow>(
          `SELECT id FROM articles WHERE id = $1 AND (user_id = $2 OR user_id IS NULL)`,
          [id, userId]
        );
      } else {
        // Fallback: используем article_id для старых данных без UUID
        console.log('[articles-api PUT] Searching by article_id', { id, userId });
        // Проверяем, что статья существует И (принадлежит пользователю ИЛИ является публичной)
        // Публичные статьи имеют user_id = NULL
        checkResult = await query<ArticleRow>(
          `SELECT id FROM articles WHERE article_id = $1 AND (user_id = $2 OR user_id IS NULL)`,
          [id, userId]
        );
      }

      console.log('[articles-api PUT] Check result', {
        rowsFound: checkResult.rows.length,
        foundId: checkResult.rows.length > 0 ? checkResult.rows[0].id : null,
      });

      if (checkResult.rows.length === 0) {
        console.log('[articles-api PUT] Article not found or access denied', {
          id,
          isUUID,
          userId: userId?.substring(0, 10) + '...',
        });
        return createErrorResponse(404, 'Article not found or access denied');
      }

      // Получаем реальный UUID для обновления
      const realId = checkResult.rows[0].id;

      // Формируем динамический UPDATE запрос
      const updates: string[] = [];
      const values: any[] = [];
      let paramIndex = 1;

      if (data.nameArticle !== undefined) {
        updates.push(`name_article = $${paramIndex++}`);
        values.push(data.nameArticle);
      }
      if (data.description !== undefined) {
        updates.push(`description = $${paramIndex++}`);
        values.push(data.description);
      }
      if (data.img !== undefined) {
        updates.push(`img = $${paramIndex++}`);
        values.push(data.img);
      }
      if (data.date !== undefined) {
        updates.push(`date = $${paramIndex++}`);
        values.push(data.date);
      }
      if (data.details !== undefined) {
        updates.push(`details = $${paramIndex++}::jsonb`);
        const detailsJson = JSON.stringify(data.details);
        values.push(detailsJson);

        console.log('[articles-api PUT] Обновление details:', {
          detailsLength: Array.isArray(data.details) ? data.details.length : 'not array',
          firstDetail:
            Array.isArray(data.details) && data.details.length > 0 ? data.details[0] : null,
          detailsJsonLength: detailsJson.length,
        });
      }
      if (data.isDraft !== undefined) {
        updates.push(`is_draft = $${paramIndex++}`);
        values.push(data.isDraft);
      }

      if (updates.length === 0) {
        return createErrorResponse(400, 'No fields to update');
      }

      updates.push(`updated_at = NOW()`);
      values.push(realId, userId);

      console.log('[articles-api PUT] SQL UPDATE:', {
        updates: updates.join(', '),
        valuesCount: values.length,
        realId,
        userId,
      });

      // Используем реальный UUID id для обновления
      // Обновляем статью, если она принадлежит пользователю ИЛИ является публичной (user_id IS NULL)
      const updateResult = await query(
        `UPDATE articles 
         SET ${updates.join(', ')}
         WHERE id = $${paramIndex++} AND (user_id = $${paramIndex++} OR user_id IS NULL)
         RETURNING id, article_id, name_article, details`,
        values
      );

      console.log('[articles-api PUT] Результат обновления:', {
        rowsAffected: updateResult.rowCount,
        updatedArticle: updateResult.rows[0] || null,
      });

      if (updateResult.rowCount === 0) {
        return createErrorResponse(404, 'Article not found or update failed');
      }

      return createSuccessMessageResponse('Article updated successfully');
    }

    if (event.httpMethod === 'DELETE') {
      const userId = requireAuth(event);

      if (!userId) {
        return createErrorResponse(401, 'Unauthorized');
      }

      if (usernameOwner && usernameOwner.id !== userId) {
        return createErrorResponse(403, 'Access denied.');
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

      // Проверяем, что статья принадлежит пользователю
      const checkResult = await query<ArticleRow>(
        `SELECT id FROM articles WHERE id = $1 AND user_id = $2`,
        [id, userId]
      );

      if (checkResult.rows.length === 0) {
        return createErrorResponse(404, 'Article not found or access denied');
      }

      await query(`DELETE FROM articles WHERE id = $1 AND user_id = $2`, [id, userId]);

      return createSuccessMessageResponse('Article deleted successfully');
    }

    return createErrorResponse(405, 'Method not allowed');
  } catch (error) {
    return handleError(error, 'articles-api function');
  }
};
