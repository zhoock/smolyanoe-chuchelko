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
  is_public: boolean;
  created_at: Date;
  updated_at: Date;
}

interface ArticleData {
  articleId: string;
  nameArticle: string;
  img: string;
  date: string;
  details: unknown[];
  description: string;
}

interface CreateArticleRequest {
  articleId: string;
  nameArticle: string;
  description?: string;
  img?: string;
  date: string;
  details: unknown[];
  lang: SupportedLang;
  isPublic?: boolean;
}

interface UpdateArticleRequest {
  nameArticle?: string;
  description?: string;
  img?: string;
  date?: string;
  details?: unknown[];
  isPublic?: boolean;
}

type ArticlesResponse = ApiResponse<ArticleData[]>;

/**
 * Преобразует данные статьи из БД в формат API
 */
function mapArticleToApiFormat(article: ArticleRow): ArticleData {
  return {
    articleId: article.article_id,
    nameArticle: article.name_article,
    img: article.img || '',
    date: article.date.toISOString().split('T')[0], // YYYY-MM-DD
    details: (article.details as unknown[]) || [],
    description: article.description || '',
  };
}

export const handler: Handler = async (
  event: HandlerEvent
): Promise<{ statusCode: number; headers: Record<string, string>; body: string }> => {
  if (event.httpMethod === 'OPTIONS') {
    return createOptionsResponse();
  }

  try {
    const userId = getUserIdFromEvent(event);

    if (event.httpMethod === 'GET') {
      const { lang } = event.queryStringParameters || {};

      if (!validateLang(lang)) {
        return createErrorResponse(400, 'Invalid lang parameter. Must be "en" or "ru".');
      }

      // Получаем публичные статьи или статьи текущего пользователя
      // Публичные статьи имеют user_id = NULL и is_public = true
      // Важно: используем DISTINCT ON для исключения дубликатов по article_id
      const articlesResult = await query<ArticleRow>(
        `SELECT DISTINCT ON (article_id)
          article_id,
          name_article,
          description,
          img,
          date,
          details,
          lang
        FROM articles
        WHERE lang = $1
          AND (
            (user_id IS NULL AND is_public = true)
            OR (user_id IS NOT NULL AND user_id = $2)
          )
        ORDER BY article_id, user_id NULLS LAST, date DESC`,
        [lang, userId || null],
        0
      );

      const articles = articlesResult.rows.map(mapArticleToApiFormat);

      return createSuccessResponse(articles);
    }

    if (event.httpMethod === 'POST') {
      if (!userId) {
        return createErrorResponse(401, 'Unauthorized');
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

      await query(
        `INSERT INTO articles (user_id, article_id, name_article, description, img, date, details, lang, is_public, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8, $9, NOW(), NOW())`,
        [
          userId,
          data.articleId,
          data.nameArticle,
          data.description || null,
          data.img || null,
          data.date,
          JSON.stringify(data.details),
          data.lang,
          data.isPublic || false,
        ],
        0
      );

      return createSuccessMessageResponse('Article created successfully', 201);
    }

    if (event.httpMethod === 'PUT') {
      if (!userId) {
        return createErrorResponse(401, 'Unauthorized');
      }

      const { id } = event.queryStringParameters || {};
      const articleId = id;

      if (!articleId) {
        return createErrorResponse(400, 'Article ID is required (query parameter: id)');
      }

      const data = parseJsonBody<UpdateArticleRequest>(event.body, {} as UpdateArticleRequest);

      // Проверяем, что статья принадлежит пользователю
      const checkResult = await query<ArticleRow>(
        `SELECT id FROM articles WHERE id = $1 AND user_id = $2`,
        [articleId, userId],
        0
      );

      if (checkResult.rows.length === 0) {
        return {
          statusCode: 404,
          headers,
          body: JSON.stringify({ success: false, error: 'Article not found or access denied' }),
        };
      }

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
        values.push(JSON.stringify(data.details));
      }
      if (data.isPublic !== undefined) {
        updates.push(`is_public = $${paramIndex++}`);
        values.push(data.isPublic);
      }

      if (updates.length === 0) {
        return createErrorResponse(400, 'No fields to update');
      }

      updates.push(`updated_at = NOW()`);
      values.push(articleId, userId);

      await query(
        `UPDATE articles 
         SET ${updates.join(', ')}
         WHERE id = $${paramIndex++} AND user_id = $${paramIndex++}`,
        values,
        0
      );

      return createSuccessMessageResponse('Article updated successfully');
    }

    if (event.httpMethod === 'DELETE') {
      if (!userId) {
        return createErrorResponse(401, 'Unauthorized');
      }

      const { id } = event.queryStringParameters || {};
      const articleId = id;

      if (!articleId) {
        return createErrorResponse(400, 'Article ID is required (query parameter: id)');
      }

      // Проверяем, что статья принадлежит пользователю
      const checkResult = await query<ArticleRow>(
        `SELECT id FROM articles WHERE id = $1 AND user_id = $2`,
        [articleId, userId],
        0
      );

      if (checkResult.rows.length === 0) {
        return createErrorResponse(404, 'Article not found or access denied');
      }

      await query(`DELETE FROM articles WHERE id = $1 AND user_id = $2`, [articleId, userId], 0);

      return createSuccessMessageResponse('Article deleted successfully');
    }

    return createErrorResponse(405, 'Method not allowed');
  } catch (error) {
    return handleError(error, 'articles-api function');
  }
};
