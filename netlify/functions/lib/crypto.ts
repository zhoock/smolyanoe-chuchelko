/**
 * Утилиты для шифрования/расшифровки sensitive данных.
 * Использует AES-256-GCM для шифрования.
 *
 * Конфигурация (`ENCRYPTION_KEY`) централизована в этом модуле —
 * `getEncryptionKey()` это единственная точка чтения переменной окружения.
 * Не считывайте `process.env.ENCRYPTION_KEY` напрямую в других модулях;
 * для health-check'ов используйте `isEncryptionKeyConfigured()`.
 *
 * Формат шифротекста (backward-compatible):
 *   base64( salt[64] || iv[16] || tag[16] || ciphertext )
 *
 * Деривация ключа (порядок проверки сохранён для совместимости с уже
 * зашифрованными значениями в БД):
 *   - 44 символа и оканчивается на `=`           → base64-декод (32 байта)
 *   - 64 символа, состоит только из [0-9a-fA-F]  → hex-декод   (32 байта)
 *   - иначе                                       → scryptSync(value, 'encryption-salt', 32)
 *
 * NB про 64-символьный случай: раньше любая 64-символьная строка считалась
 * hex'ом, поэтому base64 от `openssl rand -base64 48` (тоже 64 символа, но с
 * `+`/`/`) молча декодировался в обрезанный буфер и валился глубже как
 * `Invalid key length`. Теперь hex-ветка требует строго hex-алфавит, иначе
 * происходит fallback на scrypt.
 */

import * as crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const SALT_LENGTH = 64;
const TAG_LENGTH = 16;
const TAG_POSITION = SALT_LENGTH + IV_LENGTH;
const ENCRYPTED_POSITION = TAG_POSITION + TAG_LENGTH;

/** Минимальная рекомендуемая длина исходной строки ENCRYPTION_KEY. */
const MIN_RECOMMENDED_KEY_LENGTH = 32;

let cachedEncryptionKey: Buffer | null = null;

/**
 * Возвращает 32-байтовый ключ шифрования (AES-256-GCM), полученный из
 * `process.env.ENCRYPTION_KEY`.
 *
 * Поведение:
 *  - Если переменная не задана или пуста после trim — бросает Error
 *    ('ENCRYPTION_KEY is required'). Никаких fallback-значений нет —
 *    предсказуемый «default» ключ удалён как критическая уязвимость.
 *  - В production (NODE_ENV=production) для короткой исходной строки
 *    (< {@link MIN_RECOMMENDED_KEY_LENGTH} символов) пишет warning, но не
 *    блокирует загрузку (поведение существующих деплоев не меняется).
 *  - Кэширует результат, чтобы валидация и деривация выполнялись один раз
 *    на процесс (cold-start функции).
 *
 * Backward compatibility: алгоритм выбора формата (base64 / hex / scrypt)
 * полностью совпадает с предыдущей реализацией, поэтому ранее зашифрованные
 * значения в БД (`user_payment_settings.secret_key_encrypted`) продолжают
 * расшифровываться без миграции.
 */
export function getEncryptionKey(): Buffer {
  if (cachedEncryptionKey !== null) {
    return cachedEncryptionKey;
  }

  const raw = process.env.ENCRYPTION_KEY;
  const key = typeof raw === 'string' ? raw.trim() : '';

  if (!key) {
    throw new Error(
      'ENCRYPTION_KEY is required. Set the ENCRYPTION_KEY environment variable (see .env.example).'
    );
  }

  if (process.env.NODE_ENV === 'production' && key.length < MIN_RECOMMENDED_KEY_LENGTH) {
    console.warn(
      `⚠️ ENCRYPTION_KEY is shorter than ${MIN_RECOMMENDED_KEY_LENGTH} characters. ` +
        'Use a long random value in production (e.g. `openssl rand -base64 48`).'
    );
  }

  const derived = deriveKeyFromRaw(key);

  cachedEncryptionKey = derived;
  return derived;
}

/**
 * Преобразует исходную строку `ENCRYPTION_KEY` в 32-байтовый ключ AES-256.
 *
 * Порядок проверки совпадает с предыдущей реализацией для совместимости со
 * значениями, уже сохранёнными в `user_payment_settings.secret_key_encrypted`.
 *
 * Единственное отличие — hex-ветка теперь требует строгий hex-алфавит,
 * чтобы 64-символьная base64 (например, вывод `openssl rand -base64 48`)
 * не интерпретировалась как hex с молчаливой потерей байт.
 */
function deriveKeyFromRaw(key: string): Buffer {
  if (key.length === 44 && key.endsWith('=')) {
    return Buffer.from(key, 'base64');
  }

  if (key.length === 64 && /^[0-9a-fA-F]+$/.test(key)) {
    return Buffer.from(key, 'hex');
  }

  return crypto.scryptSync(key, 'encryption-salt', 32);
}

/**
 * Безопасная проверка наличия `ENCRYPTION_KEY` для health-check'ов / диагностики
 * (не бросает, не кэширует, не выполняет деривацию).
 */
export function isEncryptionKeyConfigured(): boolean {
  const raw = process.env.ENCRYPTION_KEY;
  return typeof raw === 'string' && raw.trim().length > 0;
}

/**
 * @internal Только для тестов: сбросить кэшированный ключ, чтобы повторно
 * валидировать `process.env.ENCRYPTION_KEY`. Не используйте в runtime-коде.
 */
export function __resetEncryptionKeyCacheForTests(): void {
  cachedEncryptionKey = null;
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
