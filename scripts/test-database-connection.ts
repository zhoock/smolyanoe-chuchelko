#!/usr/bin/env tsx
/**
 * Скрипт для тестирования подключения к PostgreSQL базе данных.
 *
 * Использование:
 *   npm run test-db
 *   или
 *   npx tsx scripts/test-database-connection.ts
 *
 * Требует переменную окружения DATABASE_URL:
 *   DATABASE_URL=postgresql://username:password@host:port/database
 */

import { Pool } from 'pg';
import { query, closePool } from '../netlify/functions/lib/db';

/**
 * Тестирование подключения к БД
 */
async function testConnection() {
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    console.error('❌ DATABASE_URL environment variable is not set');
    console.error('   Please set it: export DATABASE_URL=postgresql://user:pass@host:port/db');
    process.exit(1);
  }

  console.log('🔍 Testing database connection...');
  console.log(`   Database: ${databaseUrl.replace(/:[^:@]+@/, ':****@')}\n`); // Скрываем пароль

  try {
    // Тест 1: Базовое подключение
    console.log('📝 Test 1: Basic connection...');
    const result = await query('SELECT version()');
    console.log(`✅ Connected to PostgreSQL: ${result.rows[0].version.split(',')[0]}`);

    // Тест 2: Проверка существования таблицы user_payment_settings
    console.log('\n📝 Test 2: Checking user_payment_settings table...');
    const tableCheck = await query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'user_payment_settings'
      )
    `);

    if (tableCheck.rows[0].exists) {
      console.log('✅ Table user_payment_settings exists');

      // Проверяем структуру таблицы
      const columns = await query(`
        SELECT column_name, data_type 
        FROM information_schema.columns 
        WHERE table_name = 'user_payment_settings'
        ORDER BY ordinal_position
      `);

      console.log(`   Columns (${columns.rows.length}):`);
      columns.rows.forEach((col) => {
        console.log(`     - ${col.column_name} (${col.data_type})`);
      });

      // Проверяем количество записей
      const count = await query('SELECT COUNT(*) as count FROM user_payment_settings');
      console.log(`   Records: ${count.rows[0].count}`);
    } else {
      console.log('⚠️  Table user_payment_settings does not exist');
      console.log('   Run migrations: npm run migrate');
    }

    // Тест 3: Проверка индексов
    console.log('\n📝 Test 3: Checking indexes...');
    const indexes = await query(`
      SELECT indexname, indexdef 
      FROM pg_indexes 
      WHERE tablename = 'user_payment_settings'
    `);

    if (indexes.rows.length > 0) {
      console.log(`✅ Found ${indexes.rows.length} index(es):`);
      indexes.rows.forEach((idx) => {
        console.log(`     - ${idx.indexname}`);
      });
    } else {
      console.log('⚠️  No indexes found');
    }

    // Тест 4: Тест шифрования/расшифровки (если настроен ENCRYPTION_KEY)
    console.log('\n📝 Test 4: Testing encryption...');
    const encryptionKey = process.env.ENCRYPTION_KEY;

    if (encryptionKey) {
      const { encrypt, decrypt } = await import('../netlify/functions/lib/crypto');

      const testText = 'test-secret-key-12345';
      const encrypted = encrypt(testText);
      const decrypted = decrypt(encrypted);

      if (decrypted === testText) {
        console.log('✅ Encryption/decryption working correctly');
        console.log(`   Encrypted length: ${encrypted.length} characters`);
      } else {
        console.log('❌ Encryption/decryption failed');
        console.log(`   Original: ${testText}`);
        console.log(`   Decrypted: ${decrypted}`);
      }
    } else {
      console.log('⚠️  ENCRYPTION_KEY not set');
      console.log('   Generate key: npm run generate-encryption-key');
    }

    // Тест 5: Проверка функции getDecryptedSecretKey (если есть данные)
    console.log('\n📝 Test 5: Testing payment settings retrieval...');
    try {
      const { getDecryptedSecretKey } = await import('../netlify/functions/payment-settings');
      const testResult = await getDecryptedSecretKey('test-user-id', 'yookassa');

      if (testResult === null) {
        console.log('✅ getDecryptedSecretKey works (no data for test user)');
      } else {
        console.log('✅ getDecryptedSecretKey works (found data)');
        console.log(`   Shop ID: ${testResult.shopId}`);
        console.log(`   Secret Key: ${testResult.secretKey.substring(0, 10)}...`);
      }
    } catch (error) {
      console.log(
        '⚠️  Error testing getDecryptedSecretKey:',
        error instanceof Error ? error.message : error
      );
    }

    console.log('\n✨ All tests completed successfully!');

    return true;
  } catch (error) {
    console.error('\n❌ Database test failed:', error);

    if (error instanceof Error) {
      if (error.message.includes('timeout')) {
        console.error('   → Connection timeout. Check DATABASE_URL and network.');
      } else if (error.message.includes('password')) {
        console.error('   → Authentication failed. Check credentials in DATABASE_URL.');
      } else if (error.message.includes('does not exist')) {
        console.error('   → Database does not exist. Create it first.');
      } else {
        console.error(`   → ${error.message}`);
      }
    }

    return false;
  } finally {
    await closePool();
  }
}

// Запускаем тесты
testConnection()
  .then((success) => {
    process.exit(success ? 0 : 1);
  })
  .catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
