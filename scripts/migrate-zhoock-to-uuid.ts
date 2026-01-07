// Скрипт для миграции файлов из users/zhoock/ в users/{UUID}/
// Использование: npx tsx scripts/migrate-zhoock-to-uuid.ts

// Загружаем переменные окружения из .env.local если файл существует
import { readFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const envPath = resolve(__dirname, '../.env.local');
if (existsSync(envPath)) {
  const envFile = readFileSync(envPath, 'utf-8');
  envFile.split('\n').forEach((line) => {
    const trimmedLine = line.trim();
    if (trimmedLine && !trimmedLine.startsWith('#')) {
      const match = trimmedLine.match(/^([^#=]+)=(.*)$/);
      if (match) {
        const key = match[1].trim();
        let value = match[2].trim();
        // Убираем кавычки если есть (обрабатываем одинарные и двойные кавычки)
        if (
          (value.startsWith('"') && value.endsWith('"')) ||
          (value.startsWith("'") && value.endsWith("'"))
        ) {
          value = value.slice(1, -1);
        }
        // Убираем пробелы в начале и конце (на случай если они остались)
        value = value.trim();
        process.env[key] = value;
      }
    }
  });
  console.log('✅ Переменные окружения загружены из .env.local');

  // Диагностика: проверяем наличие ключевых переменных
  const hasUrl = !!(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL);
  const hasServiceKey = !!(
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY
  );
  const serviceKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || '';

  console.log('🔍 Проверка переменных окружения:', {
    hasSupabaseUrl: hasUrl,
    hasServiceRoleKey: hasServiceKey,
    serviceKeyLength: serviceKey.length,
    serviceKeyStartsWithEyJ: serviceKey.startsWith('eyJ'),
    serviceKeyPreview: serviceKey.substring(0, 30) + '...',
  });
} else {
  console.log('⚠️  Файл .env.local не найден');
}

import { createClient } from '@supabase/supabase-js';
import { query, closePool } from '../netlify/functions/lib/db';

const STORAGE_BUCKET_NAME = 'user-media';
const OLD_USER_ID = 'zhoock';
const USER_EMAIL = 'zhoock@zhoock.ru';

// Также проверяем .env файл
const envPathDefault = resolve(__dirname, '../.env');
if (existsSync(envPathDefault)) {
  const envFile = readFileSync(envPathDefault, 'utf-8');
  envFile.split('\n').forEach((line) => {
    const trimmedLine = line.trim();
    if (trimmedLine && !trimmedLine.startsWith('#')) {
      const match = trimmedLine.match(/^([^#=]+)=(.*)$/);
      if (match) {
        const key = match[1].trim();
        let value = match[2].trim();
        if (
          (value.startsWith('"') && value.endsWith('"')) ||
          (value.startsWith("'") && value.endsWith("'"))
        ) {
          value = value.slice(1, -1);
        }
        if (!process.env[key]) {
          process.env[key] = value;
        }
      }
    }
  });
  console.log('✅ Переменные окружения загружены из .env');
}

function createSupabaseAdminClient() {
  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
  const serviceRoleKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || '';

  if (!supabaseUrl || !serviceRoleKey) {
    console.error('❌ Supabase credentials not found', {
      hasUrl: !!supabaseUrl,
      hasServiceRoleKey: !!serviceRoleKey,
    });
    console.error('\n💡 Убедитесь, что в .env.local или .env установлены:');
    console.error('   - SUPABASE_URL (или VITE_SUPABASE_URL)');
    console.error('   - SUPABASE_SERVICE_ROLE_KEY (или VITE_SUPABASE_SERVICE_ROLE_KEY)');
    console.error('\n   Получить можно из Netlify Dashboard:');
    console.error('   - Site settings → Environment variables');
    return null;
  }

  // Проверяем формат ключа (должен начинаться с eyJ)
  if (!serviceRoleKey.startsWith('eyJ')) {
    console.error('⚠️  SUPABASE_SERVICE_ROLE_KEY выглядит некорректно');
    console.error('   Ключ должен начинаться с "eyJ" (JWT токен)');
    console.error(`   Текущий ключ: ${serviceRoleKey.substring(0, 10)}...`);
    console.error('\n💡 Проверьте ключ в Supabase Dashboard:');
    console.error('   - Settings → API → service_role key (секретный)');
  }

  // Декодируем JWT для диагностики
  console.log('\n🔍 Детальная диагностика JWT токена:');
  try {
    const jwtParts = serviceRoleKey.split('.');
    if (jwtParts.length === 3) {
      // Декодируем payload (вторая часть JWT)
      const payloadBase64 = jwtParts[1];
      // Добавляем padding если нужно
      const padded = payloadBase64 + '='.repeat((4 - (payloadBase64.length % 4)) % 4);
      const payloadJson = Buffer.from(padded, 'base64').toString('utf-8');
      const payload = JSON.parse(payloadJson);

      console.log('   ✅ JWT токен валидный, информация:');
      console.log('      - Роль:', payload.role || 'не указана');
      console.log('      - Аудитория:', payload.aud || 'не указана');
      console.log('      - Выдано для:', payload.iss || 'не указано');

      // Проверяем, что роль правильная
      if (payload.role !== 'service_role') {
        console.error('   ❌ ОШИБКА: Роль в токене не "service_role"!');
        console.error(`      Текущая роль: "${payload.role}"`);
        console.error('      Это может быть anon key, а не service_role key!');
        console.error('\n   💡 Получите правильный ключ из Supabase Dashboard:');
        console.error('      Settings → API → service_role key (секретный, не anon key!)');
        return null;
      }

      // Проверяем соответствие домена
      if (payload.iss) {
        const tokenDomain = payload.iss.replace('https://', '').split('/')[0];
        const urlDomain = supabaseUrl.replace('https://', '').replace('http://', '').split('/')[0];
        console.log('      - Домен в токене:', tokenDomain);
        console.log('      - Домен в URL:', urlDomain);

        if (!tokenDomain.includes(urlDomain) && !urlDomain.includes(tokenDomain)) {
          console.error('   ⚠️  ВНИМАНИЕ: Домены могут не совпадать!');
          console.error('      Это может быть ключ из другого проекта Supabase.');
        }
      }
    } else {
      console.error(
        '   ❌ JWT токен имеет неправильный формат (должно быть 3 части, разделённые точками)'
      );
      console.error(`      Найдено частей: ${jwtParts.length}`);
      return null;
    }
  } catch (error) {
    console.error(
      '   ❌ Ошибка при декодировании JWT:',
      error instanceof Error ? error.message : error
    );
    console.error('   ⚠️  Токен может быть повреждён или некорректен');
    return null;
  }

  try {
    const client = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    });

    console.log('✅ Supabase admin client создан успешно');
    return client;
  } catch (error) {
    console.error('❌ Failed to create Supabase admin client:', error);
    return null;
  }
}

async function getUserIdByEmail(email: string): Promise<string | null> {
  if (!process.env.DATABASE_URL) {
    console.error('❌ DATABASE_URL not found in environment variables');
    console.error('   Убедитесь, что файл .env.local или .env содержит DATABASE_URL');
    return null;
  }

  try {
    const result = await query<{ id: string }>('SELECT id FROM users WHERE email = $1 LIMIT 1', [
      email,
    ]);

    if (result.rows.length === 0) {
      console.error(`❌ User with email ${email} not found`);
      return null;
    }

    return result.rows[0].id;
  } catch (error) {
    console.error('❌ Error getting user ID:', error);
    return null;
  }
}

async function listAllFilesInFolder(
  supabase: ReturnType<typeof createSupabaseAdminClient> | null,
  folderPath: string
): Promise<string[]> {
  if (!supabase) return [];

  const allFiles: string[] = [];
  let offset = 0;
  const limit = 1000;

  while (true) {
    const { data, error } = await supabase.storage.from(STORAGE_BUCKET_NAME).list(folderPath, {
      limit,
      offset,
      sortBy: { column: 'name', order: 'asc' },
    });

    if (error) {
      // Более детальная обработка ошибок
      if (error.message?.includes('base64url decode') || error.statusCode === '403') {
        console.error(`❌ Error listing files in ${folderPath}:`, error.message);
        console.error(`   ⚠️  Проблема с SUPABASE_SERVICE_ROLE_KEY - проверьте правильность ключа`);
        console.error(`   💡 Получите правильный ключ из Supabase Dashboard:`);
        console.error(`      Settings → API → service_role key (секретный)`);
        console.error(`   💡 Убедитесь, что ключ установлен в .env.local как:`);
        console.error(`      SUPABASE_SERVICE_ROLE_KEY=eyJ... (должен начинаться с eyJ)`);
      } else {
        console.error(`❌ Error listing files in ${folderPath}:`, error);
      }
      break;
    }

    if (!data || data.length === 0) {
      break;
    }

    // Добавляем файлы и папки
    for (const item of data) {
      // Пропускаем системные файлы macOS
      if (item.name === '.DS_Store') {
        continue;
      }

      if (item.id) {
        // Это файл
        allFiles.push(`${folderPath}/${item.name}`);
      } else {
        // Это папка, рекурсивно получаем файлы
        const subFolderPath = `${folderPath}/${item.name}`;
        const subFiles = await listAllFilesInFolder(supabase, subFolderPath);
        allFiles.push(...subFiles);
      }
    }

    if (data.length < limit) {
      break;
    }

    offset += limit;
  }

  return allFiles;
}

async function migrateFiles(
  supabase: ReturnType<typeof createSupabaseAdminClient> | null,
  oldUserId: string,
  newUserId: string
): Promise<{ moved: number; failed: number; skipped: number }> {
  if (!supabase) {
    return { moved: 0, failed: 0, skipped: 0 };
  }

  let moved = 0;
  let failed = 0;
  let skipped = 0;

  // Категории, которые нужно мигрировать
  const categories = ['hero', 'audio', 'stems'];

  for (const category of categories) {
    const oldFolder = `users/${oldUserId}/${category}`;
    const newFolder = `users/${newUserId}/${category}`;

    console.log(`\n📁 Обработка категории: ${category}`);
    console.log(`   Старая папка: ${oldFolder}`);
    console.log(`   Новая папка: ${newFolder}`);

    // Получаем все файлы из старой папки
    const files = await listAllFilesInFolder(supabase, oldFolder);

    if (files.length === 0) {
      console.log(`   ⚠️  Нет файлов для миграции в папке ${oldFolder}`);
      console.log(`   💡 Это может означать:`);
      console.log(`      - Файлы уже мигрированы`);
      console.log(`      - Файлов действительно нет в этой папке`);
      console.log(`      - Проблема с доступом (проверьте SUPABASE_SERVICE_ROLE_KEY)`);
      continue;
    }

    console.log(`   📋 Найдено файлов: ${files.length}`);

    for (const oldPath of files) {
      // Пропускаем системные файлы macOS
      if (oldPath.includes('.DS_Store')) {
        console.log(`   ⏭️  Пропущен (системный файл): ${oldPath}`);
        skipped++;
        continue;
      }

      // Формируем новый путь
      const relativePath = oldPath.replace(`users/${oldUserId}/`, '');
      const newPath = `users/${newUserId}/${relativePath}`;

      try {
        // Проверяем, существует ли файл в новой папке
        const { data: existingFile } = await supabase.storage
          .from(STORAGE_BUCKET_NAME)
          .list(newPath);

        if (existingFile && existingFile.length > 0) {
          console.log(`   ⏭️  Пропущен (уже существует): ${newPath}`);
          skipped++;
          continue;
        }

        // Копируем файл
        // 1. Скачиваем из старого пути
        const { data: fileData, error: downloadError } = await supabase.storage
          .from(STORAGE_BUCKET_NAME)
          .download(oldPath);

        if (downloadError || !fileData) {
          // Если файл недоступен (возможно, не существует), пропускаем его
          const errorMessage = downloadError?.message || 'Unknown error';
          if (
            errorMessage.includes('not found') ||
            errorMessage.includes('No such key') ||
            (downloadError as any)?.statusCode === '404' ||
            (downloadError as any)?.status === 404
          ) {
            console.log(`   ⏭️  Пропущен (файл не найден): ${oldPath}`);
            skipped++;
          } else {
            console.error(`   ❌ Ошибка скачивания ${oldPath}:`, errorMessage);
            failed++;
          }
          continue;
        }

        // 2. Загружаем в новый путь
        const arrayBuffer = await fileData.arrayBuffer();
        const fileBuffer = Buffer.from(arrayBuffer);

        // Определяем content-type по расширению
        const fileName = oldPath.split('/').pop() || '';
        const ext = fileName.split('.').pop()?.toLowerCase() || '';
        const contentTypeMap: Record<string, string> = {
          jpg: 'image/jpeg',
          jpeg: 'image/jpeg',
          png: 'image/png',
          webp: 'image/webp',
          avif: 'image/avif',
          mp3: 'audio/mpeg',
          wav: 'audio/wav',
          ogg: 'audio/ogg',
        };
        const contentType = contentTypeMap[ext] || 'application/octet-stream';

        // Создаем папки если нужно
        const pathParts = newPath.split('/');
        if (pathParts.length > 1) {
          const folderPath = pathParts.slice(0, -1).join('/');
          // Проверяем существование папки (попытка создать пустой файл для проверки)
          const { error: folderError } = await supabase.storage
            .from(STORAGE_BUCKET_NAME)
            .list(folderPath);
          // Если ошибка, значит папки нет, но это нормально - Supabase создаст автоматически
        }

        const { error: uploadError } = await supabase.storage
          .from(STORAGE_BUCKET_NAME)
          .upload(newPath, fileBuffer, {
            contentType,
            upsert: true,
          });

        if (uploadError) {
          const errorMessage = uploadError.message || 'Unknown error';
          // Проверяем, не связана ли ошибка с неподдерживаемым MIME type
          if (errorMessage.includes('mime type') && errorMessage.includes('not supported')) {
            console.log(`   ⏭️  Пропущен (неподдерживаемый тип файла): ${newPath}`);
            skipped++;
          } else {
            console.error(`   ❌ Ошибка загрузки ${newPath}:`, errorMessage);
            failed++;
          }
          continue;
        }

        console.log(`   ✅ Мигрирован: ${oldPath} → ${newPath}`);
        moved++;

        // Опционально: удаляем старый файл (раскомментируйте, если хотите удалить после миграции)
        // const { error: deleteError } = await supabase.storage
        //   .from(STORAGE_BUCKET_NAME)
        //   .remove([oldPath]);
        // if (deleteError) {
        //   console.warn(`   ⚠️  Не удалось удалить старый файл ${oldPath}:`, deleteError);
        // }
      } catch (error) {
        console.error(`   ❌ Ошибка при миграции ${oldPath}:`, error);
        failed++;
      }
    }
  }

  return { moved, failed, skipped };
}

async function main() {
  console.log('🚀 Начало миграции файлов из users/zhoock/ в users/{UUID}/');
  console.log('='.repeat(60));

  // Получаем UUID пользователя
  console.log(`\n📧 Поиск пользователя с email: ${USER_EMAIL}`);
  const userId = await getUserIdByEmail(USER_EMAIL);

  if (!userId) {
    console.error('\n❌ Не удалось найти пользователя. Миграция прервана.');
    process.exit(1);
  }

  console.log(`✅ Найден UUID: ${userId}\n`);

  // Создаем Supabase клиент используя функцию из @config/supabase
  console.log('\n🔧 Создание Supabase admin клиента...');
  const supabase = createSupabaseAdminClient();
  if (!supabase) {
    console.error('\n❌ Не удалось создать Supabase клиент. Миграция прервана.');
    console.error('\n💡 Решение проблемы:');
    console.error('   1. Проверьте, что SUPABASE_SERVICE_ROLE_KEY установлен в .env.local');
    console.error('   2. Получите правильный ключ из Supabase Dashboard:');
    console.error('      Settings → API → service_role key (секретный)');
    console.error('   3. Убедитесь, что ключ начинается с "eyJ" (JWT токен)');
    console.error('   4. Проверьте, что ключ скопирован полностью (без пробелов, переносов строк)');
    process.exit(1);
  }

  console.log('✅ Supabase admin client создан успешно');

  // Проверяем валидность ключа (проверяем доступ к Storage)
  console.log('🔍 Проверка доступа к Storage...');
  try {
    // Сначала пробуем простое действие - проверить список buckets
    console.log('   → Получение списка buckets...');
    const { data: bucketsData, error: bucketsError } = await supabase.storage.listBuckets();

    if (bucketsError) {
      console.error('❌ Ошибка при получении списка buckets:', bucketsError);
      console.error('   Код:', bucketsError.statusCode);
      console.error('   Сообщение:', bucketsError.message);

      if (bucketsError.message?.includes('base64url decode') || bucketsError.statusCode === '403') {
        console.error(
          '\n❌ КРИТИЧЕСКАЯ ПРОБЛЕМА: SUPABASE_SERVICE_ROLE_KEY не соответствует проекту!'
        );
        console.error('\n💡 Шаги для решения:');
        console.error('   1. Откройте Supabase Dashboard: https://app.supabase.com');
        console.error('   2. Выберите ПРАВИЛЬНЫЙ проект (с URL:', supabaseUrl, ')');
        console.error('   3. Перейдите в: Settings → API');
        console.error('   4. Найдите раздел "Project API keys"');
        console.error('   5. Скопируйте "service_role" key (секретный, НЕ "anon" key!)');
        console.error('   6. Вставьте в .env.local как:');
        console.error(
          '      VITE_SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...'
        );
        console.error('\n⚠️  ВАЖНО:');
        console.error('   - Ключ должен быть из проекта с URL:', supabaseUrl);
        console.error('   - Это должен быть "service_role" key, НЕ "anon" key');
        console.error('   - Ключ должен быть скопирован полностью (270+ символов)');
        console.error('   - Не должно быть кавычек или пробелов в начале/конце');
        console.error('\n🔍 Текущие значения:');
        console.error('   URL:', supabaseUrl);
        console.error('   Длина ключа:', serviceRoleKey.length, 'символов');
        console.error('   Начало ключа:', serviceRoleKey.substring(0, 40) + '...');

        // Попробуем альтернативный способ проверки - через REST API
        console.error('\n🔧 Попытка альтернативной проверки через REST API...');
        try {
          const testUrl = `${supabaseUrl}/rest/v1/`;
          const response = await fetch(testUrl, {
            headers: {
              apikey: serviceRoleKey,
              Authorization: `Bearer ${serviceRoleKey}`,
            },
          });
          console.error('   REST API статус:', response.status, response.statusText);
          if (response.status === 401 || response.status === 403) {
            console.error('   ❌ REST API также возвращает ошибку авторизации');
            console.error('   Это подтверждает, что ключ не соответствует проекту');
          } else if (response.ok) {
            console.error('   ✅ REST API работает, проблема только со Storage API');
          }
        } catch (restError) {
          console.error(
            '   ⚠️  Не удалось проверить через REST API:',
            restError instanceof Error ? restError.message : restError
          );
        }
      }
      console.error('\n⚠️  Миграция не может продолжиться без доступа к Storage.');
      process.exit(1);
    }

    console.log(`   ✅ Найдено buckets: ${bucketsData?.length || 0}`);
    const targetBucket = bucketsData?.find((b) => b.name === STORAGE_BUCKET_NAME);
    if (!targetBucket) {
      console.error(`❌ Bucket "${STORAGE_BUCKET_NAME}" не найден!`);
      console.error(`   Доступные buckets: ${bucketsData?.map((b) => b.name).join(', ') || 'нет'}`);
      process.exit(1);
    }
    console.log(`   ✅ Bucket "${STORAGE_BUCKET_NAME}" найден`);

    // Теперь пробуем получить список файлов
    console.log(`   → Проверка доступа к файлам в bucket "${STORAGE_BUCKET_NAME}"...`);
    const { data: testData, error: testError } = await supabase.storage
      .from(STORAGE_BUCKET_NAME)
      .list('', { limit: 1 });

    if (testError) {
      console.error('❌ Ошибка при доступе к файлам в bucket:', testError.message);
      console.error('   Код:', testError.statusCode);
      process.exit(1);
    }
    console.log('✅ Доступ к Storage подтвержден\n');
  } catch (error) {
    console.error('❌ Неожиданная ошибка при проверке Storage:', error);
    if (error instanceof Error) {
      console.error('   Сообщение:', error.message);
      console.error('   Стек:', error.stack);
    }
    process.exit(1);
  }

  // Мигрируем файлы
  const result = await migrateFiles(supabase, OLD_USER_ID, userId);

  console.log('\n' + '='.repeat(60));
  console.log('📊 Итоги миграции:');
  console.log(`   ✅ Успешно мигрировано: ${result.moved}`);
  console.log(`   ⏭️  Пропущено (уже существует): ${result.skipped}`);
  console.log(`   ❌ Ошибок: ${result.failed}`);
  console.log('='.repeat(60));

  if (result.failed === 0) {
    console.log('\n🎉 Миграция завершена успешно!');
    console.log('\n⚠️  ВАЖНО: Старые файлы в users/zhoock/ НЕ удалены автоматически.');
    console.log(
      '   Проверьте работу сайта и вручную удалите старые файлы, если всё работает корректно.'
    );
  } else {
    console.log('\n⚠️  Миграция завершена с ошибками. Проверьте логи выше.');
    process.exit(1);
  }

  // Закрываем соединение с БД
  await closePool();
}

main().catch((error) => {
  console.error('❌ Критическая ошибка:', error);
  process.exit(1);
});
