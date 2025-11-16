#!/usr/bin/env node
/**
 * Скрипт для генерации ключа шифрования.
 *
 * Использование:
 *   npm run generate-encryption-key
 *   или
 *   node scripts/generate-encryption-key.js
 *
 * Генерирует безопасный 32-байтовый ключ в формате base64.
 */

/* eslint-env node */
const crypto = require('crypto');

console.log('🔐 Generating encryption key...\n');

// Генерируем случайный 32-байтовый ключ
const key = crypto.randomBytes(32);

// Конвертируем в base64
const keyBase64 = key.toString('base64');

console.log('✅ Encryption key generated successfully!\n');
console.log('📋 Add this to your Netlify environment variables:\n');
console.log(`   ENCRYPTION_KEY=${keyBase64}\n`);
console.log('⚠️  IMPORTANT:');
console.log('   - Keep this key secure and private');
console.log('   - Do NOT commit it to Git');
console.log('   - Use a different key for each environment (dev, staging, production)');
console.log('   - Store it in Netlify environment variables\n');
