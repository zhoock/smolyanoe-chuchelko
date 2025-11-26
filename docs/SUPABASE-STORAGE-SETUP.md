# Настройка Supabase Storage

Это руководство поможет настроить Supabase Storage для хранения изображений и других файлов пользователей.

## 📋 Предварительные требования

1. Активный проект Supabase (у вас уже есть: `jhpvetvfnsklpwswadle`)
2. Доступ к Supabase Dashboard
3. Переменные окружения настроены для Netlify

## 🔧 Шаг 1: Создание Storage Bucket

1. Откройте [Supabase Dashboard](https://supabase.com/dashboard/project/jhpvetvfnsklpwswadle)
2. В левом меню выберите **Storage**
3. Нажмите **"New bucket"**
4. Заполните форму:
   - **Name**: `user-media`
   - **Public bucket**: ✅ Включите (чтобы файлы были доступны публично)
   - **File size limit**: Установите максимальный размер (например, 10 MB)
   - **Allowed MIME types**: Оставьте пустым или укажите `image/*,audio/*`
5. Нажмите **"Create bucket"**

## 🔐 Шаг 2: Настройка политик безопасности (RLS)

Для безопасности нужно настроить Row Level Security (RLS) политики:

### Как создать политику (пошаговая инструкция):

1. В Supabase Dashboard откройте **Storage**
2. Найдите и кликните на bucket `user-media` (или создайте его, если еще не создан)
3. В верхней части страницы bucket найдите вкладки: **Files**, **Settings**, **Policies**
4. Кликните на вкладку **"Policies"**
5. Нажмите кнопку **"New Policy"** (или **"Create Policy"**)
6. **Выберите способ создания:**
   - Появится модальное окно с двумя вариантами
   - **Рекомендуется:** Выберите **"For full customization"** → **"Create policy from scratch"** (карточка с иконкой карандаша)
   - Если случайно выбрали "Get started quickly" и видите шаблоны:
     - Можно вернуться назад (кнопка "Back" или "Cancel") и выбрать "Create policy from scratch"
     - Или использовать шаблон, но его нужно будет полностью переписать под наши условия
7. **Если выбрали "Create policy from scratch":**
   - Откроется форма с полями для заполнения
   - Заполните форму:
   - **Policy name**: Введите название (например, "Public read access")
   - **Allowed operation**: Выберите операцию из выпадающего списка (SELECT, INSERT, DELETE)
   - **Policy definition**: Вставьте SQL условие в текстовое поле (см. примеры ниже)
   - Нажмите **"Review"** или **"Save"**

   **Если выбрали шаблон:**
   - Выберите любой шаблон (например, "Allow access to JPG images...")
   - Нажмите **"Use this template"**
   - В открывшемся редакторе **полностью замените** SQL код на нужное условие (см. примеры ниже)
   - Измените **Policy name** на нужное название
   - Нажмите **"Save"**

### Политики для создания:

### Политика 1: Публичный доступ на чтение

- **Policy name**: `Public read access`
- **Allowed operation**: `SELECT`
- **Target roles**: ✅ `anon` (анонимные пользователи)
- **Policy definition**:

```sql
bucket_id = 'user-media'
```

### Политика 2: Пользователи могут загружать свои файлы

- **Policy name**: `Users can upload their own files`
- **Allowed operation**: `INSERT`
- **Target roles**: ✅ `authenticated` (авторизованные пользователи)
- **Policy definition**:

```sql
bucket_id = 'user-media' AND
(auth.uid()::text = (storage.foldername(name))[1])
```

### Политика 3: Пользователи могут удалять свои файлы

- **Policy name**: `Users can delete their own files`
- **Allowed operation**: `DELETE`
- **Target roles**: ✅ `authenticated` (авторизованные пользователи)
- **Policy definition**:

```sql
bucket_id = 'user-media' AND
(auth.uid()::text = (storage.foldername(name))[1])
```

### Политика 4: Анонимная загрузка в публичный bucket (для миграции)

**Важно:** Эта политика нужна для загрузки файлов через anon ключ без авторизации (например, для миграции существующих файлов).

- **Policy name**: `Anonymous upload to public bucket`
- **Allowed operation**: `INSERT`
- **Target roles**: ✅ `anon` (анонимные пользователи)
- **Policy definition**:

```sql
bucket_id = 'user-media'
```

**Примечание:**

- Эта политика разрешает загрузку любому анонимному пользователю
- Если нужна большая безопасность, можно ограничить только папками пользователей:
  ```sql
  bucket_id = 'user-media' AND
  (storage.foldername(name))[1] = 'users'
  ```
- Для продакшена рекомендуется использовать авторизацию и политики 2 и 3 вместо этой

**Примечание:** Если вы используете строковые ID пользователей (не UUID), политики нужно будет адаптировать.

## 🔑 Шаг 3: Получение API ключей

1. В Supabase Dashboard перейдите в **Settings** → **API**
2. Найдите раздел **"Project API keys"**
3. Скопируйте:
   - **Project URL** (например: `https://jhpvetvfnsklpwswadle.supabase.co`)
   - **anon public** ключ (этот ключ безопасен для использования в клиентском коде)
   - **service_role** ключ (⚠️ **ВАЖНО:** Использовать ТОЛЬКО на сервере/в скриптах, НИКОГДА на клиенте! Нужен для миграции файлов)

## 🌐 Шаг 4: Настройка переменных окружения в Netlify

1. Откройте [Netlify Dashboard](https://app.netlify.com)
2. Выберите ваш проект
3. Перейдите в **Site settings** → **Environment variables**
4. Добавьте следующие переменные:

### Для Production:

```
VITE_SUPABASE_URL=https://jhpvetvfnsklpwswadle.supabase.co
VITE_SUPABASE_ANON_KEY=ваш_anon_ключ
SUPABASE_URL=https://jhpvetvfnsklpwswadle.supabase.co
SUPABASE_ANON_KEY=ваш_anon_ключ
VITE_USE_SUPABASE_STORAGE=true
```

**Примечание:** `VITE_USE_SUPABASE_STORAGE=true` включает использование Supabase Storage вместо локальных файлов. Установите `false` или не добавляйте переменную, чтобы использовать локальные файлы.

### Для Local development:

Добавьте те же переменные в раздел **"Local development (Netlify CLI)"** в Netlify Dashboard, включая `VITE_USE_SUPABASE_STORAGE=true` (если хотите использовать Supabase Storage в локальной разработке).

**Важно:**

- Netlify CLI **не отдаёт значения скрытых переменных** через команду `netlify env:get` (это ограничение безопасности)
- Для локальной разработки через `netlify dev` нужно **обязательно заполнить значения для контекста "Local development (Netlify CLI)"** в Dashboard
- Если значения заполнены только для Production, но не для Local development, переменные будут пустыми при запуске `netlify dev`
- В Dashboard для каждой переменной в строке "Local development (Netlify CLI)" нажмите "Add value" и введите те же значения, что и для Production

## 🧪 Шаг 5: Тестирование

### Тест 1: Проверка подключения

Создайте тестовый файл `scripts/test-supabase-storage.ts`:

```typescript
import { createSupabaseClient, STORAGE_BUCKET_NAME } from '../src/config/supabase';

async function testStorage() {
  const supabase = createSupabaseClient();

  if (!supabase) {
    console.error(
      '❌ Supabase client is not available. Please set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.'
    );
    return;
  }

  // Проверяем доступ к bucket
  const { data, error } = await supabase.storage.listBuckets();

  if (error) {
    console.error('❌ Error:', error);
    return;
  }

  console.log('✅ Buckets:', data);

  // Проверяем существование нашего bucket
  const bucketExists = data?.some((bucket) => bucket.name === STORAGE_BUCKET_NAME);

  if (bucketExists) {
    console.log(`✅ Bucket "${STORAGE_BUCKET_NAME}" exists`);
  } else {
    console.log(`❌ Bucket "${STORAGE_BUCKET_NAME}" not found`);
  }
}

testStorage();
```

Запустите через `netlify dev` (он автоматически загрузит переменные из Dashboard):

```bash
npm run dev -- --command "npx tsx scripts/test-supabase-storage.ts"
```

Или если порт 8888 занят, остановите другие процессы на этом порту и попробуйте снова.

**Примечание:** Переменные окружения автоматически загружаются из Netlify Dashboard при запуске `netlify dev`. Убедитесь, что значения заполнены для контекста "Local development (Netlify CLI)".

### Тест 2: Загрузка файла

```typescript
import { uploadFile } from '../src/shared/api/storage';

async function testUpload() {
  // Создайте тестовый файл
  const file = new File(['test'], 'test.jpg', { type: 'image/jpeg' });

  const url = await uploadFile({
    category: 'uploads',
    file,
    fileName: 'test.jpg',
  });

  if (url) {
    console.log('✅ File uploaded:', url);
  } else {
    console.log('❌ Upload failed');
  }
}
```

## 📁 Структура файлов в Storage

После настройки файлы будут храниться в следующей структуре:

```
user-media/
  users/
    zhoock/
      albums/
        album_cover.jpg
      articles/
        article_image.jpg
      profile/
        avatar.jpg
      stems/
        EP/
          EP_drummer.png
      uploads/
        user_upload.jpg
```

## 🔄 Миграция из старого bucket (user-images → user-media)

Если у вас уже есть bucket `user-images` и нужно переименовать его в `user-media`:

**Важно:** В Supabase нельзя переименовать bucket напрямую. Нужно создать новый и скопировать файлы.

### Шаг 1: Создайте новый bucket

1. В Supabase Dashboard → **Storage** → **New bucket**
2. **Name**: `user-media`
3. ✅ **Public bucket**
4. **File size limit**: 50 MB (или как у старого bucket)
5. **Allowed MIME types**: `image/*,audio/*`
6. **Create bucket**

### Шаг 2: Скопируйте RLS политики

1. Откройте старый bucket `user-images` → **Policies**
2. Скопируйте все политики
3. Откройте новый bucket `user-media` → **Policies**
4. Создайте те же политики, заменив `bucket_id = 'user-images'` на `bucket_id = 'user-media'`

### Шаг 3: Запустите скрипт миграции

```bash
npx tsx scripts/migrate-bucket.ts
```

Скрипт автоматически:

- Найдет все файлы в старом bucket
- Скопирует их в новый bucket
- Покажет статистику миграции

### Шаг 5: Проверка и очистка

1. Проверьте файлы в новом bucket `user-media`
2. Убедитесь, что все работает корректно
3. (Опционально) Удалите старый bucket `user-images` после проверки

## 📁 Миграция локальных файлов

Если у вас есть локальные файлы, их нужно загрузить в Supabase Storage:

1. Используйте функцию `uploadFile` из `src/shared/api/storage`
2. Или создайте скрипт миграции (см. пример ниже)

### Пример скрипта миграции

```typescript
import { promises as fs } from 'fs';
import * as path from 'path';
import { uploadFile } from '../src/shared/api/storage';
import { CURRENT_USER_CONFIG, ImageCategory } from '../src/config/user';

async function migrateLocalFilesToStorage() {
  const imagesDir = path.resolve(__dirname, '../src/images/users/zhoock');

  const categories: ImageCategory[] = ['albums', 'articles', 'profile', 'stems'];

  for (const category of categories) {
    const categoryDir = path.join(imagesDir, category);

    try {
      const files = await fs.readdir(categoryDir);

      for (const file of files) {
        if (file === '.gitkeep') continue;

        const filePath = path.join(categoryDir, file);
        const fileBuffer = await fs.readFile(filePath);
        const fileBlob = new Blob([fileBuffer]);

        const url = await uploadFile({
          category,
          file: fileBlob,
          fileName: file,
          contentType: 'image/jpeg', // Определите тип файла
        });

        if (url) {
          console.log(`✅ Uploaded: ${category}/${file}`);
        } else {
          console.log(`❌ Failed: ${category}/${file}`);
        }
      }
    } catch (error) {
      console.error(`Error processing ${category}:`, error);
    }
  }
}

migrateLocalFilesToStorage();
```

## 🚀 Использование в коде

### Включение Supabase Storage

По умолчанию используются локальные файлы. Чтобы включить Supabase Storage:

1. **Через переменную окружения:**

   ```bash
   VITE_USE_SUPABASE_STORAGE=true
   ```

2. **В коде:**

   ```typescript
   import { getUserImageUrl } from '@shared/api/albums';

   // Использовать Supabase Storage
   const imageUrl = getUserImageUrl('album_cover', 'albums', '.jpg', true);

   // Использовать локальные файлы (по умолчанию)
   const imageUrl = getUserImageUrl('album_cover', 'albums');
   ```

## 📝 Примечания

- **Безопасность**: Anon ключ безопасен для использования в клиентском коде, так как доступ контролируется через RLS политики
- **Лимиты**: Бесплатный тариф Supabase включает 1 GB хранилища и 2 GB трафика в месяц
- **CDN**: Supabase автоматически использует CDN для быстрой доставки файлов
- **Оптимизация**: Для изображений можно использовать Supabase Image Transformation API

## 🆘 Решение проблем

### Ошибка: "Bucket not found"

- Убедитесь, что bucket `user-media` создан и публичен
- Проверьте название bucket в `src/config/supabase.ts`

### Ошибка: "Invalid API key"

- Проверьте правильность `VITE_SUPABASE_ANON_KEY` в переменных окружения
- Убедитесь, что используете `anon` ключ, а не `service_role`

### Ошибка: "Permission denied"

- Проверьте RLS политики в Supabase Dashboard
- Убедитесь, что bucket публичен (если нужен публичный доступ)

### Файлы не загружаются

- Проверьте размер файла (не превышает лимит bucket)
- Проверьте MIME типы (если указаны ограничения)
- Проверьте логи в Netlify Functions

## 📚 Дополнительные ресурсы

- [Supabase Storage Documentation](https://supabase.com/docs/guides/storage)
- [Supabase Storage API Reference](https://supabase.com/docs/reference/javascript/storage)
- [Row Level Security Policies](https://supabase.com/docs/guides/storage/security/access-control)
