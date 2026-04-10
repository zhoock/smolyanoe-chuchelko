/**
 * Каноническая сущность трека.
 * Lyrics, storage (`src`) и плеер согласовываются только по `id` (строка: legacy "1", UUID, …).
 * Порядок в альбоме — поле `order_index`, не позиция в массиве (массив лишь представление).
 */
export type Track = {
  id: string;
  title: string;
  src: string;
  order_index: number;
};
