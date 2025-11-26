# Supabase Storage - Быстрый старт

## 🚀 Быстрая настройка (5 минут)

### 1. Создайте Storage Bucket

1. Откройте [Supabase Dashboard](https://supabase.com/dashboard/project/jhpvetvfnsklpwswadle)
2. **Storage** → **New bucket**
3. Название: `user-media`
4. ✅ **Public bucket** (включите)
5. **Create bucket**

### 2. Добавьте переменные окружения в Netlify

1. [Netlify Dashboard](https://app.netlify.com) → Ваш проект → **Site settings** → **Environment variables**
2. Добавьте:

```
VITE_SUPABASE_URL=https://jhpvetvfnsklpwswadle.supabase.co
VITE_SUPABASE_ANON_KEY=ваш_anon_ключ
SUPABASE_URL=https://jhpvetvfnsklpwswadle.supabase.co
SUPABASE_ANON_KEY=ваш_anon_ключ
```

**Где взять ключи:**

- Supabase Dashboard → **Settings** → **API**
- Скопируйте **Project URL** и **anon public** ключ

### 3. Включите Supabase Storage (опционально)

По умолчанию используются локальные файлы. Чтобы включить Supabase Storage:

**В Netlify:**

```
VITE_USE_SUPABASE_STORAGE=true
```

**Или в коде:**

```typescript
import { getUserImageUrl } from '@shared/api/albums';

// Использовать Supabase Storage
const url = getUserImageUrl('album_cover', 'albums', '.jpg', true);
```

## 📝 Использование

### Загрузка файла

```typescript
import { uploadFile } from '@shared/api/storage';

const file = new File(['...'], 'image.jpg', { type: 'image/jpeg' });

const url = await uploadFile({
  category: 'articles',
  file,
  fileName: 'my-image.jpg',
});

if (url) {
  console.log('Файл загружен:', url);
}
```

### Получение URL файла

```typescript
import { getStorageFileUrl } from '@shared/api/storage';

const url = getStorageFileUrl({
  userId: 'zhoock',
  category: 'albums',
  fileName: 'album_cover.jpg',
});
```

### Использование в компонентах

```typescript
import { getUserImageUrl } from '@shared/api/albums';

// Локальные файлы (по умолчанию)
<img src={getUserImageUrl('album_cover', 'albums')} />

// Supabase Storage
<img src={getUserImageUrl('album_cover', 'albums', '.jpg', true)} />
```

## 📚 Полная документация

См. [SUPABASE-STORAGE-SETUP.md](./SUPABASE-STORAGE-SETUP.md) для детальной настройки и решения проблем.
