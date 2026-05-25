-- Миграция: удаление legacy plaintext password column из users
-- Дата: 2026
-- Назначение: security hardening — пароли должны храниться только как bcrypt hash
-- в password_hash. Колонка password (TEXT) была добавлена миграцией 019 для
-- «внутренней админки» и представляет серьёзный риск утечки credentials.
--
-- К моменту применения этой миграции весь код перестал писать в users.password
-- (см. netlify/functions/auth.ts, change-password.ts) и перестал её SELECT'ить
-- (см. user-profile.ts). Аутентификация работает только через bcrypt-сравнение
-- с password_hash.

ALTER TABLE users
DROP COLUMN IF EXISTS password;
