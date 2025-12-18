/**
 * Скрипт миграции данных из JSON файлов в базу данных
 *
 * Использование:
 *   npx ts-node database/scripts/migrate_json_to_db.ts
 *
 * Или через Netlify Functions:
 *   netlify functions:invoke migrate-json-to-db
 */

import { query } from '../../netlify/functions/lib/db';

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
      const albumResult = await query(
        `INSERT INTO albums (
          user_id, album_id, artist, album, full_name, description,
          cover, release, buttons, details, lang, is_public
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
        ON CONFLICT (user_id, album_id, lang) 
        DO UPDATE SET
          artist = EXCLUDED.artist,
          album = EXCLUDED.album,
          full_name = EXCLUDED.full_name,
          description = EXCLUDED.description,
          cover = EXCLUDED.cover,
          release = EXCLUDED.release,
          buttons = EXCLUDED.buttons,
          details = EXCLUDED.details,
          updated_at = CURRENT_TIMESTAMP
        RETURNING id`,
        [
          userId,
          albumId,
          album.artist,
          album.album,
          album.fullName,
          album.description,
          coverValue, // cover теперь TEXT, не JSONB
          JSON.stringify(album.release),
          JSON.stringify(album.buttons),
          JSON.stringify(album.details),
          lang,
          userId === null, // публичный, если user_id NULL
        ]
      );

      const albumDbId = albumResult.rows[0].id;
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
          user_id, article_id, name_article, description, img, date, details, lang, is_public
        ) VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8, $9)
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
          userId === null, // публичный, если user_id NULL
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

// Основная функция миграции
export async function migrateJsonToDatabase(): Promise<void> {
  console.log('🚀 Начинаем миграцию JSON → БД...');

  try {
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

    // Мигрируем русские альбомы (публичные, user_id = NULL)
    console.log('📦 Мигрируем русские альбомы...');
    const ruResult = await migrateAlbumsToDb(albumsRu, 'ru', null);
    console.log('✅ RU:', {
      albums: ruResult.albumsCreated,
      tracks: ruResult.tracksCreated,
      errors: ruResult.errors.length,
    });

    // Мигрируем английские альбомы (публичные, user_id = NULL)
    console.log('📦 Мигрируем английские альбомы...');
    const enResult = await migrateAlbumsToDb(albumsEn, 'en', null);
    console.log('✅ EN:', {
      albums: enResult.albumsCreated,
      tracks: enResult.tracksCreated,
      errors: enResult.errors.length,
    });

    // Мигрируем русские статьи (публичные, user_id = NULL)
    console.log('📰 Мигрируем русские статьи...');
    const articlesRuResult = await migrateArticlesToDb(articlesRu, 'ru', null);
    console.log('✅ Статьи RU:', {
      articles: articlesRuResult.articlesCreated,
      errors: articlesRuResult.errors.length,
    });

    // Мигрируем английские статьи (публичные, user_id = NULL)
    console.log('📰 Мигрируем английские статьи...');
    const articlesEnResult = await migrateArticlesToDb(articlesEn, 'en', null);
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

    console.log('🎉 Миграция завершена!');
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
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Скрипт завершён с ошибкой:', error);
      process.exit(1);
    });
}
