# Скрипты миграции базы данных

## Универсальная миграция всех данных из JSON в базу данных

**Используйте Netlify Function для миграции всех данных:**

```bash
netlify functions:invoke migrate-json-to-db
```

Эта функция автоматически:

- Загружает переменные окружения (включая `DATABASE_URL`) из Netlify
- Мигрирует все данные из `src/assets/albums-en.json` и `src/assets/albums-ru.json`
- Включает все поля: albums, tracks, articles, details (включая Recorded At, Mixed At, Band Members, Session Musicians, Producing и т.д.)

## Важно

⚠️ **НЕ используйте `database/scripts/migrate_json_to_db.ts` напрямую** — у него нет доступа к `DATABASE_URL` через `source scripts/load-netlify-env.sh`, так как переменные окружения не передаются в дочерний процесс Node.js.

✅ **Всегда используйте Netlify Function:**

```bash
netlify functions:invoke migrate-json-to-db
```

## Структура данных

Netlify Function `migrate-json-to-db` находится в:

- `netlify/functions/migrate-json-to-db.ts`

Скрипт для прямого запуска (НЕ РЕКОМЕНДУЕТСЯ):

- `database/scripts/migrate_json_to_db.ts`

## Что мигрируется

1. **Альбомы (albums)**
   - artist, album, fullName, description
   - cover (текстовая ссылка)
   - release (JSONB: date, UPC, photographer, designer, photographerURL, designerURL)
   - buttons (JSONB: ссылки на стриминговые сервисы)
   - details (JSONB: Genre, Band Members, Session Musicians, Producing, Recorded At, Mixed At, Mastered By и т.д.)
   - lang (ru/en)

2. **Треки (tracks)**
   - title, duration, src
   - content (текст песни)
   - authorship
   - syncedLyrics

3. **Статьи (articles)**
   - nameArticle, description, img, date
   - details

## Пример вывода

```
{"success":true,"message":"Migration completed","results":{"ru":{"albums":3,"tracks":11,"articles":6,"errors":0},"en":{"albums":3,"tracks":11,"articles":6,"errors":0},"total":{"albums":6,"tracks":22,"articles":12,"errors":0}}}
```
