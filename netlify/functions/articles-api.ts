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

interface ArticleRow {
  id: string;
  user_id: string;
  article_id: string;
  name_article: string;
  description: string;
  img: string;
  date: Date;
  details: any; // JSONB
  lang: string;
  is_public: boolean;
  created_at: Date;
  updated_at: Date;
}

interface ArticlesResponse {
  success: boolean;
  data?: Array<{
    articleId: string;
    nameArticle: string;
    img: string;
    date: string;
    details: any[];
    description: string;
  }>;
  error?: string;
}

interface ArticleResponse {
  success: boolean;
  data?: {
    articleId: string;
    nameArticle: string;
    img: string;
    date: string;
    details: any[];
    description: string;
  };
  error?: string;
}

interface CreateArticleRequest {
  articleId: string;
  nameArticle: string;
  description?: string;
  img?: string;
  date: string;
  details: any[];
  lang: string;
  isPublic?: boolean;
}

interface UpdateArticleRequest {
  nameArticle?: string;
  description?: string;
  img?: string;
  date?: string;
  details?: any[];
  isPublic?: boolean;
}

import { extractUserIdFromToken } from './lib/jwt';

export const handler: Handler = async (
  event: HandlerEvent
): Promise<{ statusCode: number; headers: Record<string, string>; body: string }> => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Content-Type': 'application/json',
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  try {
    const userId = extractUserIdFromToken(event.headers.authorization);

    if (event.httpMethod === 'GET') {
      const { lang } = event.queryStringParameters || {};

      if (!lang || !['en', 'ru'].includes(lang)) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({
            success: false,
            error: 'Invalid lang parameter. Must be "en" or "ru".',
          } as ArticlesResponse),
        };
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

      const articles = articlesResult.rows.map((article) => ({
        articleId: article.article_id,
        nameArticle: article.name_article,
        img: article.img || '',
        date: article.date.toISOString().split('T')[0], // YYYY-MM-DD
        details: article.details || [],
        description: article.description || '',
      }));

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ success: true, data: articles } as ArticlesResponse),
      };
    }

    if (event.httpMethod === 'POST') {
      if (!userId) {
        return {
          statusCode: 401,
          headers,
          body: JSON.stringify({ success: false, error: 'Unauthorized' }),
        };
      }

      const data: CreateArticleRequest = JSON.parse(event.body || '{}');

      if (!data.articleId || !data.nameArticle || !data.date || !data.lang || !data.details) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({
            success: false,
            error: 'Invalid request data. Required: articleId, nameArticle, date, lang, details',
          }),
        };
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

      console.log('✅ Article created:', {
        userId,
        articleId: data.articleId,
        lang: data.lang,
      });

      return {
        statusCode: 201,
        headers,
        body: JSON.stringify({ success: true, message: 'Article created successfully' }),
      };
    }

    if (event.httpMethod === 'PUT') {
      if (!userId) {
        return {
          statusCode: 401,
          headers,
          body: JSON.stringify({ success: false, error: 'Unauthorized' }),
        };
      }

      const { id } = event.queryStringParameters || {};
      const articleId = id;

      if (!articleId) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({
            success: false,
            error: 'Article ID is required (query parameter: id)',
          }),
        };
      }

      const data: UpdateArticleRequest = JSON.parse(event.body || '{}');

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
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ success: false, error: 'No fields to update' }),
        };
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

      console.log('✅ Article updated:', { userId, articleId });

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ success: true, message: 'Article updated successfully' }),
      };
    }

    if (event.httpMethod === 'DELETE') {
      if (!userId) {
        return {
          statusCode: 401,
          headers,
          body: JSON.stringify({ success: false, error: 'Unauthorized' }),
        };
      }

      const { id } = event.queryStringParameters || {};
      const articleId = id;

      if (!articleId) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({
            success: false,
            error: 'Article ID is required (query parameter: id)',
          }),
        };
      }

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

      await query(`DELETE FROM articles WHERE id = $1 AND user_id = $2`, [articleId, userId], 0);

      console.log('✅ Article deleted:', { userId, articleId });

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ success: true, message: 'Article deleted successfully' }),
      };
    }

    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ success: false, error: 'Method not allowed' }),
    };
  } catch (error) {
    console.error('❌ Error in articles-api function:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }),
    };
  }
};
