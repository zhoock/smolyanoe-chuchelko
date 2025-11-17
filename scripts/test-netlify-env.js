#!/usr/bin/env node
/* eslint-disable no-undef */
/**
 * Скрипт для проверки переменных окружения Netlify
 *
 * Использование:
 *   npm run test-netlify-env
 *   или
 *   node scripts/test-netlify-env.js
 *
 * Проверяет:
 *   - Наличие обязательных переменных окружения
 *   - Формат DATABASE_URL
 *   - Формат ENCRYPTION_KEY
 *   - Подключение к базе данных
 *   - Работу шифрования
 */

/* eslint-env node */
const { Pool } = require('pg');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

// Загружаем переменные из .env файла, если он существует
const envPath = path.join(__dirname, '..', '.env');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf-8');
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

const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function checkEnvVar(name, required = true) {
  const value = process.env[name];
  if (!value) {
    if (required) {
      log(`❌ ${name} не установлена`, 'red');
      return false;
    } else {
      log(`⚠️  ${name} не установлена (опционально)`, 'yellow');
      return true;
    }
  }
  log(`✅ ${name} установлена`, 'green');
  return true;
}

function checkDatabaseUrl() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    return false;
  }

  // Проверка формата
  if (!databaseUrl.startsWith('postgresql://')) {
    log('❌ DATABASE_URL должен начинаться с postgresql://', 'red');
    return false;
  }

  // Проверка наличия пароля
  if (!databaseUrl.includes('@')) {
    log(
      '❌ DATABASE_URL должен содержать пароль (формат: postgresql://user:password@host:port/db)',
      'red'
    );
    return false;
  }

  log('✅ DATABASE_URL имеет правильный формат', 'green');
  return true;
}

function checkEncryptionKey() {
  const encryptionKey = process.env.ENCRYPTION_KEY;
  if (!encryptionKey) {
    return false;
  }

  // Проверка формата base64
  // Ключ может быть:
  // 1. base64 строка длиной 44 символа (32 байта в base64 = 44 символа, включая padding)
  // 2. hex строка длиной 64 символа (32 байта в hex = 64 символа)
  // 3. Любая строка (будет использован scryptSync для генерации ключа)
  try {
    // Проверяем base64 формат
    if (encryptionKey.length === 44 && encryptionKey.endsWith('=')) {
      const decoded = Buffer.from(encryptionKey, 'base64');
      if (decoded.length === 32) {
        log('✅ ENCRYPTION_KEY имеет правильный формат (base64, 32 байта)', 'green');
        return true;
      }
    }

    // Проверяем hex формат
    if (encryptionKey.length === 64) {
      const decoded = Buffer.from(encryptionKey, 'hex');
      if (decoded.length === 32) {
        log('✅ ENCRYPTION_KEY имеет правильный формат (hex, 32 байта)', 'green');
        return true;
      }
    }

    // Если не base64 и не hex, но не пустой - это тоже валидно
    // (будет использован scryptSync)
    if (encryptionKey.length > 0) {
      log('✅ ENCRYPTION_KEY установлен (будет использован scryptSync)', 'green');
      return true;
    }

    log('❌ ENCRYPTION_KEY пустой', 'red');
    return false;
  } catch (error) {
    log(`❌ ENCRYPTION_KEY не является валидным: ${error.message}`, 'red');
    return false;
  }
}

async function testDatabaseConnection() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    return false;
  }

  log('\n🔍 Тестирование подключения к базе данных...', 'blue');

  const pool = new Pool({
    connectionString: databaseUrl,
    ssl: {
      rejectUnauthorized: false,
    },
  });

  try {
    const client = await pool.connect();
    const result = await client.query('SELECT version()');
    log(`✅ Подключение к БД успешно: ${result.rows[0].version.split(' ')[0]}`, 'green');

    // Проверка существования таблиц
    const tablesToCheck = ['user_payment_settings', 'synced_lyrics'];
    let allTablesExist = true;

    for (const tableName of tablesToCheck) {
      const tableCheck = await client.query(
        `
        SELECT EXISTS (
          SELECT FROM information_schema.tables
          WHERE table_schema = 'public' AND table_name = $1
        );
      `,
        [tableName]
      );

      if (tableCheck.rows[0].exists) {
        log(`✅ Таблица ${tableName} существует`, 'green');
      } else {
        log(`❌ Таблица ${tableName} не найдена. Запустите миграции!`, 'red');
        allTablesExist = false;
      }
    }

    if (!allTablesExist) {
      client.release();
      await pool.end();
      return false;
    }

    client.release();
    await pool.end();
    return true;
  } catch (error) {
    log(`❌ Ошибка подключения к БД: ${error.message}`, 'red');
    await pool.end();
    return false;
  }
}

function testEncryption() {
  const encryptionKey = process.env.ENCRYPTION_KEY;
  if (!encryptionKey) {
    return false;
  }

  log('\n🔍 Тестирование шифрования...', 'blue');

  try {
    const key = Buffer.from(encryptionKey, 'base64');
    const testText = 'test-secret-key-123';
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
    let encrypted = cipher.update(testText, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    const tag = cipher.getAuthTag();

    // Проверка расшифровки
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(tag);
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    if (decrypted === testText) {
      log('✅ Шифрование и расшифровка работают корректно', 'green');
      return true;
    } else {
      log('❌ Ошибка: расшифрованный текст не совпадает с оригиналом', 'red');
      return false;
    }
  } catch (error) {
    log(`❌ Ошибка шифрования: ${error.message}`, 'red');
    return false;
  }
}

async function main() {
  log('\n🚀 Проверка переменных окружения Netlify\n', 'blue');

  let allChecksPassed = true;

  // Проверка обязательных переменных
  log('📋 Проверка обязательных переменных:', 'blue');
  if (!checkEnvVar('DATABASE_URL', true)) allChecksPassed = false;
  if (!checkEnvVar('ENCRYPTION_KEY', true)) allChecksPassed = false;

  // Проверка опциональных переменных
  log('\n📋 Проверка опциональных переменных:', 'blue');
  checkEnvVar('YOOKASSA_SHOP_ID', false);
  checkEnvVar('YOOKASSA_SECRET_KEY', false);

  // Проверка формата
  log('\n📋 Проверка формата переменных:', 'blue');
  if (!checkDatabaseUrl()) allChecksPassed = false;
  if (!checkEncryptionKey()) allChecksPassed = false;

  // Тестирование подключения к БД
  if (allChecksPassed) {
    if (!(await testDatabaseConnection())) allChecksPassed = false;
  }

  // Тестирование шифрования
  if (allChecksPassed) {
    if (!testEncryption()) allChecksPassed = false;
  }

  // Итоговый результат
  log('\n' + '='.repeat(50), 'blue');
  if (allChecksPassed) {
    log('✅ Все проверки пройдены успешно!', 'green');
    log('🎉 Система готова к работе!', 'green');
    process.exit(0);
  } else {
    log('❌ Некоторые проверки не пройдены', 'red');
    log('📖 См. документацию: docs/VERIFY-NETLIFY-SETUP.md', 'yellow');
    process.exit(1);
  }
}

main().catch((error) => {
  log(`\n❌ Критическая ошибка: ${error.message}`, 'red');
  process.exit(1);
});
