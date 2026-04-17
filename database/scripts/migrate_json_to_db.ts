/**
 * Скрипт миграции данных из JSON файлов в базу данных
 *
 * Использование:
 *   npm run migrate-json-to-db
 *
 * Или через Netlify Functions:
 *   netlify functions:invoke migrate-json-to-db
 */

import { query, closePool } from '../../netlify/functions/lib/db';
import * as fs from 'fs';
import * as path from 'path';

// Загружаем переменные окружения из .env файла
const envPath = path.resolve(__dirname, '../../.env');
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

// Импортируем JSON файлы
// В production эти файлы будут загружаться динамически
const albumsRuPath = './src/assets/albums-ru.json';
const albumsEnPath = './src/assets/albums-en.json';

interface MigrationResult {
  albumsCreated: number;
  tracksCreated: number;
  articlesCreated: number;
  errors: string[];
}

interface AlbumData {
  albumId?: string;
  artist: string;
  album: string;
  fullName: string;
  description: string;
  cover: any;
  release: any;
  buttons: any;
  details: any[];
  tracks?: Array<{
    id: number | string;
    title: string;
    duration?: number;
    src?: string;
    content?: string;
    authorship?: string;
    syncedLyrics?: Array<{
      text: string;
      startTime: number;
      endTime?: number;
    }>;
  }>;
}

interface ArticleData {
  articleId: string;
  nameArticle: string;
  description?: string;
  img?: string;
  date: string;
  details: any[];
}

async function migrateAlbumsToDb(
  albums: AlbumData[],
  lang: 'en' | 'ru',
  userId: string | null = null
): Promise<MigrationResult> {
  const result: MigrationResult = {
    albumsCreated: 0,
    tracksCreated: 0,
    articlesCreated: 0,
    errors: [],
  };

  for (const album of albums) {
    try {
      // Генерируем album_id, если его нет
      const albumId =
        album.albumId || `${album.artist}-${album.album}`.toLowerCase().replace(/\s+/g, '-');

      // Обрабатываем cover: если это строка, используем её напрямую, если объект - извлекаем img
      let coverValue: string | null = null;
      if (album.cover) {
        if (typeof album.cover === 'string') {
          coverValue = album.cover;
        } else if (typeof album.cover === 'object' && album.cover !== null) {
          // Если cover - объект, извлекаем img или используем первый строковый ключ
          coverValue =
            (album.cover as any).img || (album.cover as any).cover || String(album.cover);
        }
      }

      // 1. Создаём альбом
      // Проверяем, существует ли альбом с таким же album_id и lang для данного user_id
      const existingAlbum = await query<{ id: string }>(
        `SELECT id FROM albums 
         WHERE album_id = $1 AND lang = $2 AND user_id = $3
         LIMIT 1`,
        [albumId, lang, userId]
      );

      let albumDbId: string;

      if (existingAlbum.rows.length > 0) {
        // Альбом существует, обновляем его
        albumDbId = existingAlbum.rows[0].id;
        await query(
          `UPDATE albums SET
            artist = $1,
            album = $2,
            full_name = $3,
            description = $4,
            cover = $5,
            release = $6,
            buttons = $7,
            details = $8,
            updated_at = CURRENT_TIMESTAMP
          WHERE id = $9`,
          [
            album.artist,
            album.album,
            album.fullName,
            album.description,
            coverValue,
            JSON.stringify(album.release),
            JSON.stringify(album.buttons),
            JSON.stringify(album.details),
            albumDbId,
          ]
        );
      } else {
        // Альбом не существует, создаём новый
        const albumResult = await query<{ id: string }>(
          `INSERT INTO albums (
            user_id, album_id, artist, album, full_name, description,
            cover, release, buttons, details, lang, is_public
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
          RETURNING id`,
          [
            userId,
            albumId,
            album.artist,
            album.album,
            album.fullName,
            album.description,
            coverValue,
            JSON.stringify(album.release),
            JSON.stringify(album.buttons),
            JSON.stringify(album.details),
            lang,
            false, // is_public всегда false, так как все альбомы принадлежат пользователю
          ]
        );
        albumDbId = albumResult.rows[0].id;
      }

      result.albumsCreated++;

      // 2. Создаём треки
      if (album.tracks && album.tracks.length > 0) {
        for (let i = 0; i < album.tracks.length; i++) {
          const track = album.tracks[i];
          try {
            await query(
              `INSERT INTO tracks (
                album_id, track_id, title, duration, src, content,
                authorship, synced_lyrics, order_index
              ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
              ON CONFLICT (album_id, track_id)
              DO UPDATE SET
                title = EXCLUDED.title,
                duration = EXCLUDED.duration,
                src = EXCLUDED.src,
                content = EXCLUDED.content,
                authorship = EXCLUDED.authorship,
                synced_lyrics = EXCLUDED.synced_lyrics,
                order_index = EXCLUDED.order_index,
                updated_at = CURRENT_TIMESTAMP`,
              [
                albumDbId,
                String(track.id),
                track.title,
                track.duration || null,
                track.src || null,
                track.content || null,
                track.authorship || null,
                track.syncedLyrics ? JSON.stringify(track.syncedLyrics) : null,
                i,
              ]
            );
            result.tracksCreated++;
          } catch (error) {
            const errorMsg = `Track ${track.id} in album ${albumId}: ${
              error instanceof Error ? error.message : String(error)
            }`;
            result.errors.push(errorMsg);
            console.error('❌', errorMsg);
          }
        }
      }
    } catch (error) {
      const errorMsg = `Album ${album.albumId || album.album}: ${
        error instanceof Error ? error.message : String(error)
      }`;
      result.errors.push(errorMsg);
      console.error('❌', errorMsg);
    }
  }

  return result;
}

async function migrateArticlesToDb(
  articles: ArticleData[],
  lang: 'en' | 'ru',
  userId: string | null = null
): Promise<{ articlesCreated: number; errors: string[] }> {
  const result = {
    articlesCreated: 0,
    errors: [] as string[],
  };

  for (const article of articles) {
    try {
      await query(
        `INSERT INTO articles (
          user_id, article_id, name_article, description, img, date, details, lang
        ) VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8)
        ON CONFLICT (user_id, article_id, lang)
        DO UPDATE SET
          name_article = EXCLUDED.name_article,
          description = EXCLUDED.description,
          img = EXCLUDED.img,
          date = EXCLUDED.date,
          details = EXCLUDED.details,
          updated_at = CURRENT_TIMESTAMP
        RETURNING id`,
        [
          userId,
          article.articleId,
          article.nameArticle,
          article.description || null,
          article.img || null,
          article.date,
          JSON.stringify(article.details || []),
          lang,
        ]
      );
      result.articlesCreated++;
    } catch (error) {
      const errorMsg = `Article ${article.articleId}: ${
        error instanceof Error ? error.message : String(error)
      }`;
      result.errors.push(errorMsg);
      console.error('❌', errorMsg);
    }
  }

  return result;
}

// Функция для очистки дубликатов перед миграцией
async function removeDuplicateAlbumsBeforeMigration(userId: string): Promise<void> {
  console.log('🧹 Очищаем дубликаты альбомов перед миграцией...\n');

  try {
    // Удаляем дубликаты для конкретного пользователя, оставляя только одну запись для каждого album_id + lang + user_id
    // Приоритет: самые старые по created_at
    const deleteResult = await query(
      `DELETE FROM albums
       WHERE id IN (
         SELECT id
         FROM (
           SELECT id,
                  ROW_NUMBER() OVER (
                    PARTITION BY album_id, lang, user_id 
                    ORDER BY created_at ASC
                  ) as rn
           FROM albums
           WHERE user_id = $1
         ) t
         WHERE rn > 1
       )`,
      [userId]
    );

    if (deleteResult.rowCount && deleteResult.rowCount > 0) {
      console.log(`✅ Удалено ${deleteResult.rowCount} дубликатов перед миграцией\n`);
    } else {
      console.log('✅ Дубликатов не найдено\n');
    }
  } catch (error) {
    console.error('⚠️  Ошибка при очистке дубликатов (продолжаем миграцию):', error);
    // Не прерываем миграцию, если очистка не удалась
  }
}

// Основная функция миграции
export async function migrateJsonToDatabase(): Promise<void> {
  console.log('🚀 Начинаем миграцию JSON → БД...');

  try {
    const ownerEmail = process.env.SITE_OWNER_EMAIL?.trim();
    if (!ownerEmail) {
      throw new Error('SITE_OWNER_EMAIL is required for migrateJsonToDatabase');
    }
    console.log('👤 Ищем пользователя по SITE_OWNER_EMAIL...');
    const userResult = await query<{ id: string }>(
      `SELECT id FROM users WHERE email = $1 LIMIT 1`,
      [ownerEmail.toLowerCase()]
    );

    let userId: string | null = null;
    if (userResult.rows.length > 0) {
      userId = userResult.rows[0].id;
      console.log(`✅ Найден пользователь: ${userId}`);
    } else {
      console.log('⚠️  Пользователь не найден. Создаём...');
      const newUserResult = await query<{ id: string }>(
        `INSERT INTO users (email, name, is_active) 
         VALUES ($1, $2, $3) 
         RETURNING id`,
        [ownerEmail.toLowerCase(), 'Site Owner', true]
      );
      userId = newUserResult.rows[0].id;
      console.log(`✅ Создан пользователь: ${userId}`);
    }

    if (!userId) {
      throw new Error('Не удалось получить или создать пользователя');
    }

    // Сначала очищаем дубликаты
    await removeDuplicateAlbumsBeforeMigration(userId);

    // Загружаем JSON файлы
    // В Node.js окружении используем require или fs
    let albumsRu: AlbumData[];
    let albumsEn: AlbumData[];
    let articlesRu: ArticleData[];
    let articlesEn: ArticleData[];

    if (typeof require !== 'undefined') {
      // Node.js окружение
      albumsRu = require('../../src/assets/albums-ru.json');
      albumsEn = require('../../src/assets/albums-en.json');
      articlesRu = require('../../src/assets/articles-ru.json');
      articlesEn = require('../../src/assets/articles-en.json');
    } else {
      // Для браузерного окружения или если require недоступен
      // Нужно будет загружать через fetch или другой способ
      throw new Error('JSON файлы должны быть загружены через require() или fetch()');
    }

    // Мигрируем русские альбомы в профиль пользователя
    console.log('📦 Мигрируем русские альбомы...');
    const ruResult = await migrateAlbumsToDb(albumsRu, 'ru', userId);
    console.log('✅ RU:', {
      albums: ruResult.albumsCreated,
      tracks: ruResult.tracksCreated,
      errors: ruResult.errors.length,
    });

    // Мигрируем английские альбомы в профиль пользователя
    console.log('📦 Мигрируем английские альбомы...');
    const enResult = await migrateAlbumsToDb(albumsEn, 'en', userId);
    console.log('✅ EN:', {
      albums: enResult.albumsCreated,
      tracks: enResult.tracksCreated,
      errors: enResult.errors.length,
    });

    // Мигрируем русские статьи в профиль пользователя
    console.log('📰 Мигрируем русские статьи...');
    const articlesRuResult = await migrateArticlesToDb(articlesRu, 'ru', userId);
    console.log('✅ Статьи RU:', {
      articles: articlesRuResult.articlesCreated,
      errors: articlesRuResult.errors.length,
    });

    // Мигрируем английские статьи в профиль пользователя
    console.log('📰 Мигрируем английские статьи...');
    const articlesEnResult = await migrateArticlesToDb(articlesEn, 'en', userId);
    console.log('✅ Статьи EN:', {
      articles: articlesEnResult.articlesCreated,
      errors: articlesEnResult.errors.length,
    });

    // Выводим ошибки, если есть
    const allErrors = [
      ...ruResult.errors,
      ...enResult.errors,
      ...articlesRuResult.errors,
      ...articlesEnResult.errors,
    ];
    if (allErrors.length > 0) {
      console.warn('⚠️ Обнаружены ошибки:');
      allErrors.forEach((error) => console.warn('  -', error));
    }

    // Финальная проверка на дубликаты
    console.log('\n🔍 Проверяем наличие дубликатов после миграции...');
    const finalCheck = await query<{
      album_id: string;
      lang: string;
      count: number;
    }>(
      `SELECT album_id, lang, COUNT(*) as count
       FROM albums
       WHERE user_id = $1
       GROUP BY album_id, lang, user_id
       HAVING COUNT(*) > 1`,
      [userId]
    );

    if (finalCheck.rows.length > 0) {
      console.warn(`⚠️  Обнаружено ${finalCheck.rows.length} групп дубликатов после миграции:`);
      for (const row of finalCheck.rows) {
        console.warn(`  - ${row.album_id} (${row.lang}): ${row.count} записей`);
      }
      console.warn('\n💡 Запустите скрипт remove-duplicate-albums для очистки дубликатов');
    } else {
      console.log('✅ Дубликатов не обнаружено');
    }

    console.log('\n🎉 Миграция завершена!');
    console.log('📊 Итого:');
    console.log(`  - Альбомы RU: ${ruResult.albumsCreated}`);
    console.log(`  - Треки RU: ${ruResult.tracksCreated}`);
    console.log(`  - Альбомы EN: ${enResult.albumsCreated}`);
    console.log(`  - Треки EN: ${enResult.tracksCreated}`);
    console.log(`  - Статьи RU: ${articlesRuResult.articlesCreated}`);
    console.log(`  - Статьи EN: ${articlesEnResult.articlesCreated}`);
    console.log(`  - Ошибок: ${allErrors.length}`);
  } catch (error) {
    console.error('❌ Критическая ошибка миграции:', error);
    throw error;
  }
}

// Если скрипт запускается напрямую
if (require.main === module) {
  migrateJsonToDatabase()
    .then(() => {
      console.log('✅ Скрипт завершён успешно');
      closePool();
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Скрипт завершён с ошибкой:', error);
      closePool();
      process.exit(1);
    });
}
