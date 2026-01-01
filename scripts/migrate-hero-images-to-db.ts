#!/usr/bin/env tsx
/**
 * Скрипт для миграции существующих hero изображений в базу данных
 *
 * Использование:
 *   npx tsx scripts/migrate-hero-images-to-db.ts
 *
 * Требует переменную окружения DATABASE_URL:
 *   DATABASE_URL=postgresql://username:password@host:port/database
 */

import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { query, closePool } from '../netlify/functions/lib/db';

// Загружаем переменные окружения из .env
const envPath = join(__dirname, '..', '.env');
if (existsSync(envPath)) {
  const envFile = readFileSync(envPath, 'utf-8');
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
}

// Существующие hero изображения (URL из папки /images/hero/)
const EXISTING_HERO_IMAGES = [
  '/images/hero/2.jpg',
  '/images/hero/3.jpg',
  '/images/hero/4.jpg',
  '/images/hero/5.jpg',
  '/images/hero/6.jpg',
  '/images/hero/7.jpg',
  '/images/hero/8.jpg',
  '/images/hero/9.jpg',
];

async function migrateHeroImages() {
  try {
    console.log('🚀 Начинаем миграцию hero изображений в БД...\n');

    // Получаем первого активного пользователя
    const userResult = await query<{ id: string; email: string }>(
      `SELECT id, email FROM users WHERE is_active = true LIMIT 1`
    );

    if (userResult.rows.length === 0) {
      console.error('❌ Не найдено активных пользователей в БД');
      return;
    }

    const userId = userResult.rows[0].id;
    const userEmail = userResult.rows[0].email;

    console.log(`📋 Найден пользователь: ${userEmail} (${userId})\n`);

    // Проверяем, существует ли поле header_images
    try {
      const checkResult = await query(`SELECT header_images FROM users WHERE id = $1`, [userId]);
      console.log('✅ Поле header_images существует в БД\n');
    } catch (error: any) {
      if (error?.message?.includes('column') && error?.message?.includes('header_images')) {
        console.error('❌ Поле header_images не существует в БД');
        console.error('   Выполните миграцию 022_add_header_images_to_users.sql сначала');
        return;
      }
      throw error;
    }

    // Обновляем header_images
    console.log('📤 Загружаем изображения в БД...');
    const result = await query(
      `UPDATE users 
       SET header_images = $1::jsonb, updated_at = NOW()
       WHERE id = $2`,
      [JSON.stringify(EXISTING_HERO_IMAGES), userId]
    );

    if (result.rowCount && result.rowCount > 0) {
      console.log(`✅ Успешно добавлено ${EXISTING_HERO_IMAGES.length} изображений в БД:`);
      EXISTING_HERO_IMAGES.forEach((url, index) => {
        console.log(`   ${index + 1}. ${url}`);
      });
      console.log('\n✅ Миграция завершена успешно!');
    } else {
      console.error('❌ Не удалось обновить header_images');
    }
  } catch (error) {
    console.error('❌ Ошибка при миграции:', error);
    throw error;
  } finally {
    await closePool();
  }
}

// Запускаем миграцию
migrateHeroImages()
  .then(() => {
    console.log('\n🎉 Миграция завершена!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 Критическая ошибка:', error);
    process.exit(1);
  });
