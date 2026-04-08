/**
 * Единый источник кодов жанров для UI и бэкенда (Netlify).
 * Должен совпадать с строками в таблице `genres` — см. database/migrations/030_create_genres_table_and_fk.sql.
 * При добавлении жанра: обновить этот файл и добавить миграцию с INSERT INTO genres ... ON CONFLICT DO NOTHING.
 */

export type GenreOption = {
  code: string;
  label: {
    en: string;
    ru: string;
  };
};

export const CANONICAL_GENRES: readonly GenreOption[] = [
  { code: 'grunge', label: { en: 'Grunge', ru: 'Гранж' } },
  { code: 'alternative', label: { en: 'Alternative', ru: 'Альтернатива' } },
  { code: 'punk', label: { en: 'Punk', ru: 'Панк' } },
  { code: 'rock', label: { en: 'Rock', ru: 'Рок' } },
  { code: 'metal', label: { en: 'Metal', ru: 'Метал' } },
  { code: 'other', label: { en: 'Other', ru: 'Другое' } },
];

const CODE_SET = new Set(CANONICAL_GENRES.map((g) => g.code));

/** Список кодов в том же порядке, что и в UI. */
export const CANONICAL_GENRE_CODES: readonly string[] = CANONICAL_GENRES.map((g) => g.code);

export function isCanonicalGenreCode(code: string): boolean {
  return CODE_SET.has(code);
}
