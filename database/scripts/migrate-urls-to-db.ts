/**
 * Скрипт миграции URL данных из JSON файлов в базу данных
 * Обновляет блоки: Band members, Session musicians, Producing, Mixed At, Mastered By
 *
 * Использование:
 *   source scripts/load-netlify-env.sh
 *   npx tsx database/scripts/migrate-urls-to-db.ts
 */

import { readFileSync } from 'fs';
import { join } from 'path';
import { query } from '../../netlify/functions/lib/db';

const JSON_FILES = [
  { path: join(process.cwd(), 'src/assets/albums-en.json'), lang: 'en' as const },
  { path: join(process.cwd(), 'src/assets/albums-ru.json'), lang: 'ru' as const },
];

interface AlbumData {
  albumId?: string;
  artist: string;
  album: string;
  details?: Array<{
    id: number;
    title: string;
    content: unknown[];
  }>;
}

// Маппинг названий блоков для разных языков
const BLOCK_TITLES = {
  bandMembers: { en: 'Band members', ru: 'Исполнители' },
  sessionMusicians: { en: 'Session musicians', ru: 'Сессионные музыканты' },
  producing: { en: 'Producing', ru: 'Продюсирование' },
  recordingMixing: { en: 'Recording/Mixing', ru: 'Запись/сведение' },
  mixedAt: { en: 'Mixed At', ru: 'Запись/сведение' },
  masteredBy: { en: 'Mastered By', ru: 'Мастеринг' },
  mastering: { en: 'Mastering', ru: 'Мастеринг' },
};

async function migrateURLsToDB() {
  console.log(
    '🚀 Starting URL migration for Band members, Session musicians, Producing, Mixed At, Mastered By...\n'
  );

  let totalUpdated = 0;
  let totalErrors = 0;

  for (const { path: filePath, lang } of JSON_FILES) {
    console.log(`\n📄 Processing file: ${filePath} (lang: ${lang})`);

    try {
      const fileContent = readFileSync(filePath, 'utf-8');
      const albums: AlbumData[] = JSON.parse(fileContent);

      if (!Array.isArray(albums)) {
        console.error(`❌ File ${filePath} does not contain an array of albums`);
        continue;
      }

      for (const album of albums) {
        if (!album.albumId) {
          console.warn(`⚠️  Skipping album without albumId: ${album.artist} - ${album.album}`);
          continue;
        }

        // Получаем текущий альбом из базы данных
        const albumResult = await query<{
          id: number;
          album_id: string;
          details: unknown[];
        }>(
          `SELECT id, album_id, details FROM albums 
           WHERE album_id = $1 AND lang = $2 AND user_id IS NULL
           ORDER BY created_at DESC LIMIT 1`,
          [album.albumId, lang]
        );

        if (albumResult.rows.length === 0) {
          console.warn(`⚠️  Album ${album.albumId} (${lang}) not found in database`);
          continue;
        }

        const dbAlbum = albumResult.rows[0];
        const currentDetails =
          (dbAlbum.details as Array<{ id: number; title: string; content: unknown[] }>) || [];
        const updatedDetails = [...currentDetails];
        let hasChanges = false;

        // 1. Обновляем Band members
        const bandMembersTitle = BLOCK_TITLES.bandMembers[lang];
        const jsonBandMembers = album.details?.find(
          (detail) => detail && detail.title === bandMembersTitle
        );
        if (jsonBandMembers) {
          const index = updatedDetails.findIndex((d) => d.title === bandMembersTitle);
          if (index >= 0) {
            updatedDetails[index] = jsonBandMembers;
            hasChanges = true;
          } else {
            updatedDetails.push(jsonBandMembers);
            hasChanges = true;
          }
        }

        // 2. Обновляем Session musicians
        const sessionMusiciansTitle = BLOCK_TITLES.sessionMusicians[lang];
        const jsonSessionMusicians = album.details?.find(
          (detail) => detail && detail.title === sessionMusiciansTitle
        );
        if (jsonSessionMusicians) {
          const index = updatedDetails.findIndex((d) => d.title === sessionMusiciansTitle);
          if (index >= 0) {
            updatedDetails[index] = jsonSessionMusicians;
            hasChanges = true;
          } else {
            updatedDetails.push(jsonSessionMusicians);
            hasChanges = true;
          }
        }

        // 3. Обновляем Producing
        const producingTitle = BLOCK_TITLES.producing[lang];
        const jsonProducing = album.details?.find(
          (detail) => detail && detail.title === producingTitle
        );
        if (jsonProducing) {
          const index = updatedDetails.findIndex((d) => d.title === producingTitle);
          if (index >= 0) {
            updatedDetails[index] = jsonProducing;
            hasChanges = true;
          } else {
            updatedDetails.push(jsonProducing);
            hasChanges = true;
          }
        }

        // 4. Обновляем Recording/Mixing (если есть отдельный блок)
        const recordingMixingTitle = BLOCK_TITLES.recordingMixing[lang];
        const jsonRecordingMixing = album.details?.find(
          (detail) => detail && detail.title === recordingMixingTitle
        );
        if (jsonRecordingMixing) {
          const index = updatedDetails.findIndex((d) => d.title === recordingMixingTitle);
          if (index >= 0) {
            updatedDetails[index] = jsonRecordingMixing;
            hasChanges = true;
          } else {
            updatedDetails.push(jsonRecordingMixing);
            hasChanges = true;
          }
        }

        // 5. Обновляем Mixed At
        const mixedAtTitle = BLOCK_TITLES.mixedAt[lang];
        const jsonMixedAt = album.details?.find(
          (detail) => detail && detail.title === mixedAtTitle
        );
        if (jsonMixedAt) {
          const index = updatedDetails.findIndex((d) => d.title === mixedAtTitle);
          if (index >= 0) {
            updatedDetails[index] = jsonMixedAt;
            hasChanges = true;
          } else {
            updatedDetails.push(jsonMixedAt);
            hasChanges = true;
          }
        }

        // 6. Обновляем Mastered By
        const masteredByTitle = BLOCK_TITLES.masteredBy[lang];
        const jsonMasteredBy = album.details?.find(
          (detail) => detail && detail.title === masteredByTitle
        );
        if (jsonMasteredBy) {
          const index = updatedDetails.findIndex((d) => d.title === masteredByTitle);
          if (index >= 0) {
            updatedDetails[index] = jsonMasteredBy;
            hasChanges = true;
          } else {
            updatedDetails.push(jsonMasteredBy);
            hasChanges = true;
          }
        }

        // Обновляем альбом в базе данных, если были изменения
        if (hasChanges) {
          await query(
            `UPDATE albums 
             SET details = $1::jsonb 
             WHERE id = $2`,
            [JSON.stringify(updatedDetails), dbAlbum.id]
          );

          console.log(`✅ Updated URLs for album ${album.albumId} (${lang})`);
          totalUpdated++;
        } else {
          console.log(`ℹ️  No changes for album ${album.albumId} (${lang})`);
        }
      }
    } catch (error) {
      console.error(`❌ Error processing file ${filePath}:`, error);
      totalErrors++;
    }
  }

  console.log(`\n✨ Migration completed!`);
  console.log(`   Updated: ${totalUpdated} albums`);
  console.log(`   Errors: ${totalErrors}`);
}

// Запускаем миграцию
if (require.main === module) {
  migrateURLsToDB()
    .then(() => {
      console.log('\n✅ Migration finished successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ Migration failed:', error);
      process.exit(1);
    });
}
