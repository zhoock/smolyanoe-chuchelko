/**
 * Утилиты для шифрования/расшифровки sensitive данных.
 * Использует AES-256-GCM для шифрования.
 */

import * as crypto from 'crypto';

// Длина ключа для AES-256 (32 байта = 256 бит)
const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16; // 16 байт для IV
const SALT_LENGTH = 64; // 64 байта для соли
const TAG_LENGTH = 16; // 16 байт для аутентификационного тега
const TAG_POSITION = SALT_LENGTH + IV_LENGTH;
const ENCRYPTED_POSITION = TAG_POSITION + TAG_LENGTH;

/**
 * Получить ключ шифрования из переменной окружения или сгенерировать его.
 * В production ВСЕГДА используйте переменную окружения!
 */
function getEncryptionKey(): Buffer {
  const key = process.env.ENCRYPTION_KEY;

  if (!key) {
    console.warn('⚠️ ENCRYPTION_KEY not set. Using default key (NOT SECURE FOR PRODUCTION!)');
    // В production это НЕ должно использоваться!
    // Используйте: openssl rand -base64 32 для генерации безопасного ключа
    return crypto.scryptSync('default-key-change-in-production', 'salt', 32);
  }

  // Ключ должен быть в base64 формате или 32-байтовым
  if (key.length === 44 && key.endsWith('=')) {
    // base64 encoded key
    return Buffer.from(key, 'base64');
  }

  // Прямой 32-байтовый ключ
  if (key.length === 64) {
    return Buffer.from(key, 'hex');
  }

  // Генерируем ключ из строки (менее безопасно)
  return crypto.scryptSync(key, 'encryption-salt', 32);
}

/**
 * Шифрует строку используя AES-256-GCM.
 * @param text - Текст для шифрования
 * @returns Зашифрованная строка в формате base64
 */
export function encrypt(text: string): string {
  if (!text) {
    throw new Error('Text to encrypt cannot be empty');
  }

  try {
    const key = getEncryptionKey();
    const iv = crypto.randomBytes(IV_LENGTH);
    const salt = crypto.randomBytes(SALT_LENGTH);

    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

    // Шифруем текст
    let encrypted = cipher.update(text, 'utf8', 'base64');
    encrypted += cipher.final('base64');

    // Получаем аутентификационный тег
    const tag = cipher.getAuthTag();

    // Составляем финальную строку: salt + iv + tag + encrypted
    const result = Buffer.concat([salt, iv, tag, Buffer.from(encrypted, 'base64')]).toString(
      'base64'
    );

    return result;
  } catch (error) {
    console.error('❌ Encryption error:', error);
    throw new Error(
      `Encryption failed: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

/**
 * Расшифровывает строку используя AES-256-GCM.
 * @param encryptedText - Зашифрованная строка в формате base64
 * @returns Расшифрованный текст
 */
export function decrypt(encryptedText: string): string {
  if (!encryptedText) {
    throw new Error('Encrypted text cannot be empty');
  }

  try {
    const key = getEncryptionKey();
    const data = Buffer.from(encryptedText, 'base64');

    // Извлекаем компоненты
    const salt = data.subarray(0, SALT_LENGTH);
    const iv = data.subarray(SALT_LENGTH, TAG_POSITION);
    const tag = data.subarray(TAG_POSITION, ENCRYPTED_POSITION);
    const encrypted = data.subarray(ENCRYPTED_POSITION);

    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(tag);

    let decrypted = decipher.update(encrypted, undefined, 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
  } catch (error) {
    console.error('❌ Decryption error:', error);
    throw new Error(
      `Decryption failed: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}
