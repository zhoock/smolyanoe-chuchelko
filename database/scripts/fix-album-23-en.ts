#!/usr/bin/env tsx
/**
 * Скрипт для исправления данных альбома "23" (en) в базе данных
 * Обновляет details из JSON файла
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

interface AlbumData {
  albumId: string;
  details: any[];
}

async function fixAlbum23En(): Promise<void> {
  console.log('🚀 Исправляем данные альбома "23" (en)...\n');

  try {
    // Загружаем JSON файл
    const albumsEn = require('../../src/assets/albums-en.json') as AlbumData[];
    const album23 = albumsEn.find((a) => a.albumId === '23');

    if (!album23) {
      console.error('❌ Альбом "23" не найден в albums-en.json');
      process.exit(1);
    }

    console.log('✅ Найден альбом "23" в JSON файле');
    console.log('📋 Details:', JSON.stringify(album23.details, null, 2));

    // Находим альбом в базе данных
    const albumResult = await query<{ id: string; album_id: string; lang: string }>(
      `SELECT id, album_id, lang FROM albums WHERE album_id = $1 AND lang = $2 AND user_id IS NULL`,
      ['23', 'en']
    );

    if (albumResult.rows.length === 0) {
      console.error('❌ Альбом "23" (en) не найден в базе данных');
      process.exit(1);
    }

    const dbAlbum = albumResult.rows[0];
    console.log(`✅ Найден альбом в БД: ${dbAlbum.id}`);

    // Обновляем details
    await query(
      `UPDATE albums 
       SET details = $1::jsonb, updated_at = NOW() 
       WHERE id = $2`,
      [JSON.stringify(album23.details), dbAlbum.id]
    );

    console.log('✅ Данные альбома "23" (en) обновлены в базе данных');
  } catch (error) {
    console.error('❌ Ошибка:', error);
    throw error;
  }
}

if (require.main === module) {
  fixAlbum23En()
    .then(() => {
      console.log('✅ Скрипт завершён успешно');
      closePool();
    })
    .catch((error) => {
      console.error('❌ Ошибка выполнения скрипта:', error);
      closePool();
      process.exit(1);
    });
}
