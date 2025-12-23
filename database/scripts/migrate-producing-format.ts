/**
 * Скрипт миграции формата блоков "Продюсирование" / "Producing" в базе данных
 * Преобразует формат с ["", "Имя", " — роль"] на ["Имя", "роль"]
 *
 * Использование:
 *   npx tsx database/scripts/migrate-producing-format.ts
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

interface ProducingContentItem {
  text: string[] | string;
  link?: string;
}

function convertProducingContent(content: unknown[]): unknown[] {
  return content.map((item) => {
    // Если это объект с text массивом
    if (typeof item === 'object' && item !== null && 'text' in item) {
      const obj = item as ProducingContentItem;

      if (Array.isArray(obj.text)) {
        // Формат ["", "Имя", " — роль"] -> ["Имя", "роль"]
        if (
          obj.text.length === 3 &&
          obj.text[0] === '' &&
          typeof obj.text[2] === 'string' &&
          obj.text[2].startsWith(' — ')
        ) {
          const name = String(obj.text[1]).trim();
          const role = String(obj.text[2]).replace(/^ — /, '').trim(); // Убираем " — " в начале

          const result: { text: string[]; link?: string } = {
            text: [name, role],
          };

          if (obj.link) {
            result.link = String(obj.link).trim();
          }

          return result;
        }

        // Если уже в формате ["Имя", "роль"], оставляем как есть
        if (obj.text.length === 2) {
          return item;
        }
      }
    }

    // Остальное оставляем как есть
    return item;
  });
}

async function migrateProducingFormat() {
  console.log('🔄 Начинаем миграцию формата блоков "Продюсирование" / "Producing"...\n');

  try {
    // Получаем все альбомы
    const albumsResult = await query<{
      id: string;
      album_id: string;
      lang: string;
      details: unknown;
    }>(`SELECT id, album_id, lang, details FROM albums`);

    if (albumsResult.rows.length === 0) {
      console.log('ℹ️  Альбомы не найдены в базе данных');
      return;
    }

    console.log(`📦 Найдено ${albumsResult.rows.length} альбомов для проверки\n`);

    let totalUpdated = 0;
    const producingTitles = ['Продюсирование', 'Producing'];

    for (const album of albumsResult.rows) {
      try {
        // Парсим details
        let details: unknown[] = [];
        if (album.details) {
          if (typeof album.details === 'string') {
            try {
              details = JSON.parse(album.details);
            } catch (error) {
              console.error(
                `❌ Ошибка парсинга details для альбома ${album.album_id} (${album.lang}):`,
                error
              );
              continue;
            }
          } else if (Array.isArray(album.details)) {
            details = album.details;
          } else {
            console.warn(
              `⚠️  Неожиданный формат details для альбома ${album.album_id} (${album.lang})`
            );
            continue;
          }
        }

        // Ищем блок "Продюсирование" / "Producing"
        let hasChanges = false;
        const updatedDetails = details.map((detail: any) => {
          if (
            detail &&
            typeof detail === 'object' &&
            detail.title &&
            producingTitles.includes(String(detail.title)) &&
            Array.isArray(detail.content)
          ) {
            const convertedContent = convertProducingContent(detail.content);

            // Проверяем, есть ли изменения
            const originalStr = JSON.stringify(detail.content);
            const convertedStr = JSON.stringify(convertedContent);

            if (originalStr !== convertedStr) {
              hasChanges = true;
              return {
                ...detail,
                content: convertedContent,
              };
            }
          }
          return detail;
        });

        // Если есть изменения, обновляем альбом
        if (hasChanges) {
          await query(
            `UPDATE albums SET details = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2`,
            [JSON.stringify(updatedDetails), album.id]
          );
          totalUpdated++;
          console.log(`✅ Обновлен альбом: ${album.album_id} (${album.lang})`);
        }
      } catch (error) {
        console.error(`❌ Ошибка при обработке альбома ${album.album_id} (${album.lang}):`, error);
      }
    }

    console.log(`\n✨ Миграция завершена! Обновлено альбомов: ${totalUpdated}`);
  } catch (error) {
    console.error('❌ Критическая ошибка при миграции:', error);
    throw error;
  } finally {
    await closePool();
  }
}

// Запускаем миграцию
if (require.main === module) {
  migrateProducingFormat()
    .then(() => {
      console.log('✅ Скрипт завершён успешно');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Скрипт завершён с ошибкой:', error);
      process.exit(1);
    });
}

export { migrateProducingFormat };
