// src/hooks/__tests__/data.test.ts
import { jest, describe, test, expect } from '@jest/globals';
import { getImageUrl, formatDate, useAlbumsData } from '@hooks/data';

// Мокаем только то, что нужно из react-router-dom
jest.mock('react-router-dom', () => ({
  useRouteLoaderData: jest.fn(),
}));

import { useRouteLoaderData } from 'react-router-dom';

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
    // Берём "середину дня" в UTC, чтобы не было сюрпризов с часовыми поясами
    const iso = '2024-01-05T12:34:56Z';
    expect(formatDate(iso)).toBe('05/01/2024');
  });
});

describe('useAlbumsData', () => {
  test('возвращает данные лоадера, если они есть', () => {
    (useRouteLoaderData as jest.Mock).mockReturnValueOnce({ albums: ['a'] } as any);
    const result = useAlbumsData('ru');
    expect(result).toEqual({ albums: ['a'] });
  });

  test('возвращает null, если лоадер вернул null', () => {
    (useRouteLoaderData as jest.Mock).mockReturnValueOnce(null);
    const result = useAlbumsData('ru');
    expect(result).toBeNull();
  });
});
