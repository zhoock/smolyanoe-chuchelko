/**
 * Скрипт для удаления старых блоков "Recording/Mixing" из базы данных
 * Эти блоки больше не используются - их заменяют отдельные блоки "Recorded At" и "Mixed At"
 *
 * Использование:
 *   source scripts/load-netlify-env.sh
 *   npx tsx database/scripts/remove-recording-mixing-blocks.ts
 */

import { query } from '../../netlify/functions/lib/db';

async function removeRecordingMixingBlocks() {
  console.log('🚀 Starting removal of "Recording/Mixing" blocks...\n');

  let totalUpdated = 0;
  let totalRemoved = 0;
  let totalErrors = 0;

  try {
    // Получаем все альбомы с details
    const albumsResult = await query<{
      id: number;
      album_id: string;
      lang: string;
      details: unknown[];
    }>(
      `SELECT id, album_id, lang, details 
       FROM albums 
       WHERE details IS NOT NULL 
       AND user_id IS NULL`
    );

    if (albumsResult.rows.length === 0) {
      console.log('ℹ️  No albums found');
      return;
    }

    console.log(`📊 Found ${albumsResult.rows.length} albums to check\n`);

    for (const album of albumsResult.rows) {
      const details = album.details as Array<{ id: number; title: string; content: unknown[] }>;

      if (!Array.isArray(details)) {
        continue;
      }

      // Ищем блок "Recording/Mixing" или "Запись/сведение"
      const recordingMixingIndex = details.findIndex(
        (detail) =>
          detail && (detail.title === 'Recording/Mixing' || detail.title === 'Запись/сведение')
      );

      if (recordingMixingIndex >= 0) {
        // Удаляем блок
        const updatedDetails = [...details];
        updatedDetails.splice(recordingMixingIndex, 1);

        // Обновляем альбом в базе данных
        await query(
          `UPDATE albums 
           SET details = $1::jsonb 
           WHERE id = $2`,
          [JSON.stringify(updatedDetails), album.id]
        );

        console.log(
          `✅ Removed "Recording/Mixing" block from album ${album.album_id} (${album.lang})`
        );
        totalRemoved++;
        totalUpdated++;
      } else {
        console.log(
          `ℹ️  No "Recording/Mixing" block found in album ${album.album_id} (${album.lang})`
        );
      }
    }
  } catch (error) {
    console.error(`❌ Error processing albums:`, error);
    totalErrors++;
  }

  console.log(`\n✨ Migration completed!`);
  console.log(`   Updated: ${totalUpdated} albums`);
  console.log(`   Removed blocks: ${totalRemoved}`);
  console.log(`   Errors: ${totalErrors}`);
}

// Запускаем миграцию
if (require.main === module) {
  removeRecordingMixingBlocks()
    .then(() => {
      console.log('\n✅ Migration finished successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ Migration failed:', error);
      process.exit(1);
    });
}
