/**
 * Скрипт миграции данных Band members из JSON файлов в базу данных
 *
 * Использование:
 *   source scripts/load-netlify-env.sh
 *   npx tsx database/scripts/migrate-band-members.ts
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

async function migrateBandMembers() {
  console.log('🚀 Starting Band Members migration...\n');

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

      // Определяем название блока Band members в зависимости от языка
      const bandMembersTitle = lang === 'ru' ? 'Исполнители' : 'Band members';

      for (const album of albums) {
        if (!album.albumId) {
          console.warn(`⚠️  Skipping album without albumId: ${album.artist} - ${album.album}`);
          continue;
        }

        // Ищем блок Band members в details
        const bandMembersDetail = album.details?.find(
          (detail) => detail && detail.title === bandMembersTitle
        );

        if (!bandMembersDetail || !bandMembersDetail.content) {
          console.log(`ℹ️  No Band members found for album ${album.albumId}`);
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
        const currentDetails = (dbAlbum.details as Array<{ id: number; title: string }>) || [];

        // Находим индекс блока Band members в текущих details
        const bandMembersIndex = currentDetails.findIndex(
          (detail) => detail && detail.title === bandMembersTitle
        );

        // Обновляем details: заменяем или добавляем блок Band members
        const updatedDetails = [...currentDetails];
        if (bandMembersIndex >= 0) {
          updatedDetails[bandMembersIndex] = bandMembersDetail;
        } else {
          updatedDetails.push(bandMembersDetail);
        }

        // Обновляем альбом в базе данных
        await query(
          `UPDATE albums 
           SET details = $1::jsonb 
           WHERE id = $2`,
          [JSON.stringify(updatedDetails), dbAlbum.id]
        );

        console.log(`✅ Updated Band members for album ${album.albumId} (${lang})`);
        totalUpdated++;
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
  migrateBandMembers()
    .then(() => {
      console.log('\n✅ Migration finished successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ Migration failed:', error);
      process.exit(1);
    });
}
