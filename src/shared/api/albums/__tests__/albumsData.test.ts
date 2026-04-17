import { describe, test, expect } from '@jest/globals';

const TEST_USER_ID = '00000000-0000-4000-8000-000000000001';

jest.mock('@shared/lib/auth', () => ({
  getUser: () => ({
    id: '00000000-0000-4000-8000-000000000001',
    email: 'test@example.com',
    name: null,
  }),
}));

import { getImageUrl, getUserImageUrl, formatDate } from '@shared/api/albums';

describe('getImageUrl', () => {
  test('по умолчанию добавляет .jpg (обратная совместимость)', () => {
    expect(getImageUrl('covers/album1')).toBe('/images/covers/album1.jpg');
  });

  test('использует переданный формат (обратная совместимость)', () => {
    expect(getImageUrl('covers/album1', '.webp')).toBe('/images/covers/album1.webp');
  });

  test('использует новую структуру с userId и category', () => {
    expect(
      getImageUrl('album_cover', '.jpg', { userId: TEST_USER_ID, category: 'albums' })
    ).toMatch(/users%2F.*%2Falbums%2Falbum_cover\.jpg/);
  });

  test('работает с разными категориями', () => {
    expect(
      getImageUrl('article_img', '.jpg', { userId: TEST_USER_ID, category: 'articles' })
    ).toMatch(/users%2F.*%2Farticles%2Farticle_img\.jpg/);
    expect(getImageUrl('avatar', '.png', { userId: TEST_USER_ID, category: 'profile' })).toMatch(
      /users%2F.*%2Fprofile%2Favatar\.png/
    );
  });
});

describe('getUserImageUrl', () => {
  test('генерирует URL для текущего пользователя', () => {
    expect(getUserImageUrl('album_cover', 'albums')).toContain('users%2F');
    expect(getUserImageUrl('album_cover', 'albums')).toContain('%2Falbums%2Falbum_cover.jpg');
  });

  test('использует переданный формат', () => {
    expect(getUserImageUrl('album_cover', 'albums', '.webp')).toContain(
      '%2Falbums%2Falbum_cover.webp'
    );
  });

  test('работает с разными категориями', () => {
    expect(getUserImageUrl('article_img', 'articles')).toContain('%2Farticles%2Farticle_img.jpg');
    expect(getUserImageUrl('avatar', 'profile', '.png')).toContain('%2Fprofile%2Favatar.png');
  });
});

describe('formatDate', () => {
  test('форматирует ISO дату в dd/mm/yyyy', () => {
    const iso = '2024-01-05T12:34:56Z';
    expect(formatDate(iso)).toBe('05/01/2024');
  });
});
