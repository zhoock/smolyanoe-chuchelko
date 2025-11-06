#!/usr/bin/env node
/**
 * Скрипт для обновления JSON файлов альбомов данными из экспорта localStorage
 *
 * Использование:
 * 1. Экспортируйте данные из localStorage (запустите export-localStorage.js в браузере)
 * 2. Сохраните файл как localStorage-export.json в корне проекта
 * 3. Запустите: node scripts/update-json-from-export.js
 */

const fs = require('fs');
const path = require('path');

// Пути к файлам
const EXPORT_FILE = path.join(__dirname, '..', 'localStorage-export.json');
const ALBUMS_RU = path.join(__dirname, '..', 'src', 'assets', 'albums-ru.json');
const ALBUMS_EN = path.join(__dirname, '..', 'src', 'assets', 'albums-en.json');

// Парсим ключ localStorage и извлекаем данные
function parseKey(key) {
  // Формат: synced-lyrics-{lang}-{albumId}-{trackId}
  // Формат: track-text-{lang}-{albumId}-{trackId}
  // Формат: track-text-authorship-{lang}-{albumId}-{trackId}

  const parts = key.split('-');

  if (key.startsWith('synced-lyrics-')) {
    // synced-lyrics-ru-23-remastered-1
    const lang = parts[2];
    const albumId = parts.slice(3, -1).join('-'); // всё кроме последнего (trackId)
    const trackId = parts[parts.length - 1];
    return { type: 'syncedLyrics', lang, albumId, trackId: parseInt(trackId) };
  } else if (key.startsWith('track-text-authorship-')) {
    // track-text-authorship-ru-23-remastered-1
    const lang = parts[3];
    const albumId = parts.slice(4, -1).join('-');
    const trackId = parts[parts.length - 1];
    return { type: 'authorship', lang, albumId, trackId: parseInt(trackId) };
  } else if (key.startsWith('track-text-')) {
    // track-text-ru-23-remastered-1
    const lang = parts[2];
    const albumId = parts.slice(3, -1).join('-');
    const trackId = parts[parts.length - 1];
    return { type: 'content', lang, albumId, trackId: parseInt(trackId) };
  }

  return null;
}

// Читаем экспортированные данные
function loadExportData() {
  if (!fs.existsSync(EXPORT_FILE)) {
    console.error('❌ Файл localStorage-export.json не найден!');
    console.error('   Сначала экспортируйте данные из localStorage в браузере.');
    process.exit(1);
  }

  const content = fs.readFileSync(EXPORT_FILE, 'utf-8');
  return JSON.parse(content);
}

// Обновляем JSON файл
function updateAlbumsJson(albumsPath, lang, exportData) {
  console.log(`\n📝 Обновляю ${path.basename(albumsPath)}...`);

  const albums = JSON.parse(fs.readFileSync(albumsPath, 'utf-8'));
  let updatedCount = 0;

  // Обрабатываем синхронизации
  for (const [key, syncedLyrics] of Object.entries(exportData.syncedLyrics || {})) {
    const parsed = parseKey(key);
    if (!parsed || parsed.lang !== lang || parsed.type !== 'syncedLyrics') continue;

    const album = albums.find((a) => a.albumId === parsed.albumId);
    if (!album) {
      console.warn(`  ⚠️  Альбом ${parsed.albumId} не найден`);
      continue;
    }

    const track = album.tracks.find((t) => t.id === parsed.trackId);
    if (!track) {
      console.warn(`  ⚠️  Трек ${parsed.trackId} не найден в альбоме ${parsed.albumId}`);
      continue;
    }

    track.syncedLyrics = syncedLyrics;
    updatedCount++;
    console.log(`  ✅ Обновлён трек ${track.title} (ID: ${track.id})`);
  }

  // Обрабатываем авторство
  for (const [key, authorship] of Object.entries(exportData.authorship || {})) {
    const parsed = parseKey(key);
    if (!parsed || parsed.lang !== lang || parsed.type !== 'authorship') continue;

    const album = albums.find((a) => a.albumId === parsed.albumId);
    if (!album) continue;

    const track = album.tracks.find((t) => t.id === parsed.trackId);
    if (!track) continue;

    if (!track.authorship) {
      track.authorship = authorship;
      console.log(`  ✅ Добавлено авторство для трека ${track.title} (ID: ${track.id})`);
    }
  }

  // Сохраняем обновлённый файл
  fs.writeFileSync(albumsPath, JSON.stringify(albums, null, 2) + '\n', 'utf-8');
  console.log(`  📊 Обновлено треков: ${updatedCount}`);

  return updatedCount;
}

// Главная функция
function main() {
  console.log('🚀 Начинаю обновление JSON файлов...\n');

  const exportData = loadExportData();

  console.log('📦 Найдено данных:');
  console.log(`   - Синхронизаций: ${Object.keys(exportData.syncedLyrics || {}).length}`);
  console.log(`   - Текстов: ${Object.keys(exportData.trackText || {}).length}`);
  console.log(`   - Авторств: ${Object.keys(exportData.authorship || {}).length}`);

  let totalUpdated = 0;

  // Обновляем русский файл
  if (fs.existsSync(ALBUMS_RU)) {
    totalUpdated += updateAlbumsJson(ALBUMS_RU, 'ru', exportData);
  }

  // Обновляем английский файл
  if (fs.existsSync(ALBUMS_EN)) {
    totalUpdated += updateAlbumsJson(ALBUMS_EN, 'en', exportData);
  }

  console.log(`\n✅ Готово! Обновлено треков: ${totalUpdated}`);
  console.log('📤 Теперь можно выгрузить обновлённые JSON файлы на сервер.');
}

main();
