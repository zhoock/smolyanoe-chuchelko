#!/usr/bin/env tsx
/**
 * Скрипт для обновления hero изображений в БД с использованием image-set() с AVIF и JPG вариантами
 *
 * Использование:
 *   npx tsx scripts/update-hero-images-with-variants.ts
 *
 * Требует переменную окружения DATABASE_URL
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

/**
 * Генерирует image-set() строку для изображения
 */
function generateImageSet(imageNumber: number): string {
  return `image-set(
    url('/images/hero/${imageNumber}.avif') type('image/avif'),
    url('/images/hero/${imageNumber}.jpg') type('image/jpg')
  )`;
}

async function updateHeroImagesWithVariants() {
  try {
    console.log('🚀 Начинаем обновление hero изображений в БД...\n');

    // Получаем первого активного пользователя
    const userResult = await query<{ id: string; email: string; header_images: any }>(
      `SELECT id, email, header_images FROM users WHERE is_active = true LIMIT 1`
    );

    if (userResult.rows.length === 0) {
      console.error('❌ Не найдено активных пользователей в БД');
      return;
    }

    const userId = userResult.rows[0].id;
    const userEmail = userResult.rows[0].email;
    const currentHeaderImages = userResult.rows[0].header_images || [];

    console.log(`📋 Найден пользователь: ${userEmail} (${userId})`);
    console.log(
      `📊 Текущие изображения в БД: ${Array.isArray(currentHeaderImages) ? currentHeaderImages.length : 0}\n`
    );

    // Преобразуем текущие пути в image-set() строки
    const updatedImages: string[] = [];

    for (const imagePath of currentHeaderImages) {
      if (typeof imagePath === 'string') {
        // Извлекаем номер изображения из пути, например "/images/hero/2.jpg" -> 2
        const match = imagePath.match(/\/images\/hero\/(\d+)\.jpg$/);
        if (match) {
          const imageNumber = parseInt(match[1], 10);
          const imageSet = generateImageSet(imageNumber);
          updatedImages.push(imageSet);
          console.log(`✅ Обновлено: ${imagePath} -> image-set с AVIF и JPG`);
        } else {
          // Если не удалось распарсить, оставляем как есть
          console.log(`⚠️  Пропущено (не распознан формат): ${imagePath}`);
          updatedImages.push(imagePath);
        }
      } else {
        // Если это уже image-set строка, оставляем как есть
        updatedImages.push(imagePath);
      }
    }

    if (updatedImages.length === 0) {
      console.log('⚠️  Нет изображений для обновления');
      return;
    }

    // Обновляем header_images в БД
    console.log(`\n📤 Обновляем БД с ${updatedImages.length} изображениями...`);
    const result = await query(
      `UPDATE users 
       SET header_images = $1::jsonb, updated_at = NOW()
       WHERE id = $2`,
      [JSON.stringify(updatedImages), userId]
    );

    if (result.rowCount && result.rowCount > 0) {
      console.log(`\n✅ Успешно обновлено ${updatedImages.length} изображений в БД:`);
      updatedImages.forEach((img, index) => {
        if (img.includes('image-set')) {
          const match = img.match(/\/images\/hero\/(\d+)/);
          const num = match ? match[1] : '?';
          console.log(`   ${index + 1}. Изображение ${num} (image-set с AVIF и JPG)`);
        } else {
          console.log(`   ${index + 1}. ${img.substring(0, 50)}...`);
        }
      });
      console.log('\n✅ Обновление завершено успешно!');
    } else {
      console.error('❌ Не удалось обновить header_images');
    }
  } catch (error) {
    console.error('❌ Ошибка при обновлении:', error);
    throw error;
  } finally {
    await closePool();
  }
}

// Запускаем обновление
updateHeroImagesWithVariants()
  .then(() => {
    console.log('\n🎉 Готово!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 Критическая ошибка:', error);
    process.exit(1);
  });
