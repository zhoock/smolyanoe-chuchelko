/**
 * Скрипт для обновления статей из JSON файлов в базу данных
 * Обновляет только поле details (где может быть массив img)
 *
 * Использование:
 *   npx tsx scripts/update-articles-from-json.ts
 */

import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { query } from '../netlify/functions/lib/db';

// Загружаем переменные из .env файла, если он существует
const envPath = join(__dirname, '..', '.env');
if (existsSync(envPath)) {
  const envContent = readFileSync(envPath, 'utf-8');
  envContent.split('\n').forEach((line) => {
    const trimmedLine = line.trim();
    if (trimmedLine && !trimmedLine.startsWith('#')) {
      const [key, ...valueParts] = trimmedLine.split('=');
      if (key && valueParts.length > 0) {
        const value = valueParts.join('=').replace(/^["']|["']$/g, '');
        if (!process.env[key]) {
          process.env[key] = value;
        }
      }
    }
  });
}

interface ArticleData {
  articleId: string;
  nameArticle: string;
  description?: string;
  img?: string;
  date: string;
  details: any[];
}

async function updateArticlesFromJson(
  articles: ArticleData[],
  lang: 'en' | 'ru'
): Promise<{ updated: number; errors: string[] }> {
  const result = {
    updated: 0,
    errors: [] as string[],
  };

  for (const article of articles) {
    try {
      // Используем INSERT ... ON CONFLICT для создания или полного обновления статьи
      await query(
        `INSERT INTO articles (
          user_id, article_id, name_article, description, img, date, details, lang, is_public
        ) VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8, $9)
        ON CONFLICT (user_id, article_id, lang)
        DO UPDATE SET
          name_article = EXCLUDED.name_article,
          description = EXCLUDED.description,
          img = EXCLUDED.img,
          date = EXCLUDED.date,
          details = EXCLUDED.details,
          is_public = EXCLUDED.is_public,
          updated_at = CURRENT_TIMESTAMP
        RETURNING id`,
        [
          null, // публичная статья (user_id = NULL)
          article.articleId,
          article.nameArticle,
          article.description || null,
          article.img || null,
          article.date,
          JSON.stringify(article.details || []),
          lang,
          true, // публичная
        ],
        0
      );

      console.log(`✅ Migrated article ${article.articleId} (${lang}): ${article.nameArticle}`);
      result.updated++;
    } catch (error) {
      const errorMsg = `Article ${article.articleId} (${lang}): ${
        error instanceof Error ? error.message : String(error)
      }`;
      result.errors.push(errorMsg);
      console.error('❌', errorMsg);
    }
  }

  return result;
}

async function main() {
  console.log('🚀 Обновляем статьи из JSON → БД...');

  // Проверяем наличие DATABASE_URL
  if (!process.env.DATABASE_URL) {
    console.error('❌ DATABASE_URL environment variable is not set');
    console.error('   Убедитесь, что файл .env существует и содержит DATABASE_URL');
    console.error('   Или установите переменную: export DATABASE_URL=postgresql://...');
    process.exit(1);
  }

  try {
    // Загружаем JSON файлы
    let articlesRu: ArticleData[];
    let articlesEn: ArticleData[];

    if (typeof require !== 'undefined') {
      articlesRu = require('../src/assets/articles-ru.json');
      articlesEn = require('../src/assets/articles-en.json');
    } else {
      throw new Error('JSON файлы должны быть загружены через require()');
    }

    // Обновляем русские статьи
    console.log('📰 Обновляем русские статьи...');
    const ruResult = await updateArticlesFromJson(articlesRu, 'ru');
    console.log('✅ Статьи RU:', {
      updated: ruResult.updated,
      errors: ruResult.errors.length,
    });

    // Обновляем английские статьи
    console.log('📰 Обновляем английские статьи...');
    const enResult = await updateArticlesFromJson(articlesEn, 'en');
    console.log('✅ Статьи EN:', {
      updated: enResult.updated,
      errors: enResult.errors.length,
    });

    // Выводим ошибки, если есть
    const allErrors = [...ruResult.errors, ...enResult.errors];
    if (allErrors.length > 0) {
      console.warn('⚠️ Обнаружены ошибки:');
      allErrors.forEach((error) => console.warn('  -', error));
    }

    console.log('🎉 Обновление завершено!');
    console.log(`  - Статьи RU: ${ruResult.updated}`);
    console.log(`  - Статьи EN: ${enResult.updated}`);
    console.log(`  - Ошибок: ${allErrors.length}`);
  } catch (error) {
    console.error('❌ Критическая ошибка:', error);
    throw error;
  }
}

// Запускаем скрипт
if (require.main === module) {
  main()
    .then(() => {
      console.log('✅ Скрипт завершён успешно');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Скрипт завершён с ошибкой:', error);
      process.exit(1);
    });
}
