import { describe, test, expect } from '@jest/globals';
import { getImageUrl, formatDate } from '@shared/api/albums';

describe('getImageUrl', () => {
  test('по умолчанию добавляет .jpg', () => {
    expect(getImageUrl('covers/album1')).toBe('/images/covers/album1.jpg');
  });

  test('использует переданный формат', () => {
    expect(getImageUrl('covers/album1', '.webp')).toBe('/images/covers/album1.webp');
  });
});

describe('formatDate', () => {
  test('форматирует ISO дату в dd/mm/yyyy', () => {
    const iso = '2024-01-05T12:34:56Z';
    expect(formatDate(iso)).toBe('05/01/2024');
  });
});
