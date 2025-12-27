/**
 * Скрипт для выгрузки всех статей из базы данных
 *
 * Использование:
 *   npx tsx scripts/export-articles-from-db.ts
 */

import { query, closePool } from '../netlify/functions/lib/db';
import * as fs from 'fs';
import * as path from 'path';

// Загружаем переменные окружения из .env файла
const envPath = path.resolve(__dirname, '../.env');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf-8');
  envContent.split('\n').forEach((line) => {
    const trimmedLine = line.trim();
    if (trimmedLine && !trimmedLine.startsWith('#')) {
      const [key, ...valueParts] = trimmedLine.split('=');
      if (key && valueParts.length > 0) {
        const value = valueParts.join('=').replace(/^["']|["']$/g, '');
        process.env[key.trim()] = value.trim();
      }
    }
  });
}

interface ArticleRow {
  id: string;
  user_id: string | null;
  article_id: string;
  name_article: string;
  description: string | null;
  img: string | null;
  date: Date;
  details: unknown; // JSONB
  lang: string;
  is_draft: boolean | null;
  created_at: Date;
  updated_at: Date;
}

async function exportArticlesFromDb() {
  console.log('🔄 Начинаем выгрузку статей из базы данных...\n');

  try {
    // Получаем все статьи
    const articlesResult = await query<ArticleRow>(
      `SELECT 
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
        updated_at
      FROM articles
      ORDER BY lang, article_id, created_at ASC`
    );

    if (articlesResult.rows.length === 0) {
      console.log('ℹ️  Статьи не найдены в базе данных');
      return;
    }

    console.log(`📦 Найдено ${articlesResult.rows.length} статей\n`);

    // Группируем статьи по языкам
    const articlesByLang: Record<string, ArticleRow[]> = {
      ru: [],
      en: [],
    };

    for (const article of articlesResult.rows) {
      if (article.lang === 'ru' || article.lang === 'en') {
        articlesByLang[article.lang].push(article);
      }
    }

    // Формируем структуру для вывода
    const output = {
      totalArticles: articlesResult.rows.length,
      exportedAt: new Date().toISOString(),
      articles: articlesResult.rows.map((article) => ({
        id: article.id,
        articleId: article.article_id,
        nameArticle: article.name_article,
        description: article.description || '',
        img: article.img || '',
        date: article.date.toISOString().split('T')[0], // YYYY-MM-DD
        details: article.details || [],
        lang: article.lang,
        isDraft: article.is_draft ?? false,
        userId: article.user_id,
        createdAt: article.created_at.toISOString(),
        updatedAt: article.updated_at.toISOString(),
      })),
      byLang: {
        ru: articlesByLang.ru.map((article) => ({
          id: article.id,
          articleId: article.article_id,
          nameArticle: article.name_article,
          description: article.description || '',
          img: article.img || '',
          date: article.date.toISOString().split('T')[0],
          details: article.details || [],
          isDraft: article.is_draft ?? false,
          userId: article.user_id,
          createdAt: article.created_at.toISOString(),
          updatedAt: article.updated_at.toISOString(),
        })),
        en: articlesByLang.en.map((article) => ({
          id: article.id,
          articleId: article.article_id,
          nameArticle: article.name_article,
          description: article.description || '',
          img: article.img || '',
          date: article.date.toISOString().split('T')[0],
          details: article.details || [],
          isDraft: article.is_draft ?? false,
          userId: article.user_id,
          createdAt: article.created_at.toISOString(),
          updatedAt: article.updated_at.toISOString(),
        })),
      },
    };

    // Сохраняем в JSON файл
    const outputPath = path.resolve(__dirname, '../articles-export.json');
    fs.writeFileSync(outputPath, JSON.stringify(output, null, 2), 'utf-8');
    console.log(`✅ Данные сохранены в файл: ${outputPath}\n`);

    // Также сохраняем отдельные файлы по языкам (для совместимости с существующей структурой)
    const ruPath = path.resolve(__dirname, '../articles-export-ru.json');
    const enPath = path.resolve(__dirname, '../articles-export-en.json');

    fs.writeFileSync(ruPath, JSON.stringify(output.byLang.ru, null, 2), 'utf-8');
    fs.writeFileSync(enPath, JSON.stringify(output.byLang.en, null, 2), 'utf-8');

    console.log(`✅ Данные сохранены в файлы:`);
    console.log(`   - ${outputPath}`);
    console.log(`   - ${ruPath}`);
    console.log(`   - ${enPath}\n`);

    // Выводим статистику
    console.log('📊 Статистика:');
    console.log(`   Всего статей: ${output.totalArticles}`);
    console.log(`   Статей RU: ${articlesByLang.ru.length}`);
    console.log(`   Статей EN: ${articlesByLang.en.length}`);

    // Статистика по черновикам
    const drafts = articlesResult.rows.filter((a) => a.is_draft === true);
    const published = articlesResult.rows.filter((a) => !a.is_draft || a.is_draft === false);
    console.log(`   Опубликовано: ${published.length}`);
    console.log(`   Черновиков: ${drafts.length}`);

    // Статистика по пользователям
    const withUserId = articlesResult.rows.filter((a) => a.user_id !== null);
    const publicArticles = articlesResult.rows.filter((a) => a.user_id === null);
    console.log(`   Публичных статей: ${publicArticles.length}`);
    console.log(`   Пользовательских статей: ${withUserId.length}`);

    // Статистика по деталям
    const withDetails = articlesResult.rows.filter((a) => {
      const details = a.details;
      return details && Array.isArray(details) && (details as any[]).length > 0;
    });
    console.log(`   Статей с деталями: ${withDetails.length}`);

    // Выводим список статей
    console.log('\n📰 Статьи:');
    articlesResult.rows.forEach((article) => {
      const draftMark = article.is_draft ? ' [DRAFT]' : '';
      const userMark = article.user_id ? ` [USER: ${article.user_id}]` : '';
      console.log(
        `   ${article.article_id} (${article.lang}): ${article.name_article}${draftMark}${userMark}`
      );
    });

    console.log('\n✨ Выгрузка завершена!');
  } catch (error) {
    console.error('❌ Критическая ошибка при выгрузке:', error);
    throw error;
  } finally {
    await closePool();
  }
}

// Запускаем выгрузку
if (require.main === module) {
  exportArticlesFromDb()
    .then(() => {
      console.log('✅ Скрипт завершён успешно');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Скрипт завершён с ошибкой:', error);
      process.exit(1);
    });
}

export { exportArticlesFromDb };
