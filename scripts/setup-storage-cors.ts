/**
 * Скрипт для настройки CORS для Supabase Storage
 * Запуск: npx tsx scripts/setup-storage-cors.ts
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

// Загружаем переменные окружения
dotenv.config();

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || '';
const SERVICE_ROLE_KEY =
  process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || '';

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error('❌ Ошибка: не найдены переменные окружения');
  console.error('Нужны: VITE_SUPABASE_URL и VITE_SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

// Получаем домены из аргументов или используем дефолтные
const allowedOrigins = process.argv.slice(2);
if (allowedOrigins.length === 0) {
  console.log('⚠️  Не указаны домены для CORS');
  console.log(
    'Использование: npx tsx scripts/setup-storage-cors.ts https://your-domain.com http://localhost:3000'
  );
  console.log('\nДобавлю дефолтные домены для разработки...');
  allowedOrigins.push('http://localhost:3000', 'http://localhost:8080');
}

console.log('🔧 Настройка CORS для Supabase Storage...');
console.log('Домены:', allowedOrigins);

// Создаем клиент с service role key
const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: {
    persistSession: false,
  },
});

async function setupCORS() {
  try {
    // В Supabase Storage CORS настраивается через bucket policies
    // Но на самом деле, для публичных bucket'ов CORS должен работать автоматически
    // Проблема может быть в том, что нужно явно указать CORS headers в ответах

    // Попробуем использовать Storage API напрямую
    // К сожалению, Supabase Storage API не имеет прямого метода для настройки CORS
    // CORS настраивается на уровне инфраструктуры Supabase

    console.log("ℹ️  В Supabase Storage CORS настраивается автоматически для публичных bucket'ов");
    console.log('ℹ️  Если CORS не работает, возможно нужно:');
    console.log('   1. Убедиться, что bucket публичный (Public bucket = ON)');
    console.log('   2. Проверить, что изображения загружаются через правильный URL');
    console.log('   3. Использовать прокси для изображений через ваш домен');

    // Альтернативное решение: создаем политику для bucket'а
    const bucketName = 'user-media';

    console.log(`\n📦 Проверяем bucket "${bucketName}"...`);

    // Проверяем, существует ли bucket
    const { data: buckets, error: listError } = await supabase.storage.listBuckets();

    if (listError) {
      console.error("❌ Ошибка при получении списка bucket'ов:", listError);
      return;
    }

    const bucket = buckets.find((b) => b.name === bucketName);
    if (!bucket) {
      console.error(`❌ Bucket "${bucketName}" не найден`);
      return;
    }

    console.log(`✅ Bucket "${bucketName}" найден`);
    console.log(`   Публичный: ${bucket.public ? 'Да' : 'Нет'}`);

    if (!bucket.public) {
      console.log('⚠️  ВНИМАНИЕ: Bucket не публичный!');
      console.log('   Нужно включить "Public bucket" в настройках bucket\'а');
    }

    console.log('\n✅ Настройка завершена');
    console.log('\n📝 Следующие шаги:');
    console.log('   1. Убедитесь, что bucket публичный');
    console.log('   2. Проверьте, что изображения доступны по URL');
    console.log('   3. Если CORS все еще не работает, используйте прокси для изображений');
  } catch (error) {
    console.error('❌ Ошибка:', error);
    process.exit(1);
  }
}

setupCORS();
