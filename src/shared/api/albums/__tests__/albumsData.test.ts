import { describe, test, expect } from '@jest/globals';
import { getImageUrl, getUserImageUrl, formatDate } from '@shared/api/albums';

describe('getImageUrl', () => {
  test('по умолчанию добавляет .jpg (обратная совместимость)', () => {
    expect(getImageUrl('covers/album1')).toBe('/images/covers/album1.jpg');
  });

  test('использует переданный формат (обратная совместимость)', () => {
    expect(getImageUrl('covers/album1', '.webp')).toBe('/images/covers/album1.webp');
  });

  test('использует новую структуру с userId и category', () => {
    expect(getImageUrl('album_cover', '.jpg', { userId: 'zhoock', category: 'albums' })).toBe(
      '/images/users/zhoock/albums/album_cover.jpg'
    );
  });

  test('работает с разными категориями', () => {
    expect(getImageUrl('article_img', '.jpg', { userId: 'zhoock', category: 'articles' })).toBe(
      '/images/users/zhoock/articles/article_img.jpg'
    );
    expect(getImageUrl('avatar', '.png', { userId: 'zhoock', category: 'profile' })).toBe(
      '/images/users/zhoock/profile/avatar.png'
    );
  });
});

describe('getUserImageUrl', () => {
  test('генерирует URL для текущего пользователя', () => {
    expect(getUserImageUrl('album_cover', 'albums')).toBe(
      '/images/users/zhoock/albums/album_cover.jpg'
    );
  });

  test('использует переданный формат', () => {
    expect(getUserImageUrl('album_cover', 'albums', '.webp')).toBe(
      '/images/users/zhoock/albums/album_cover.webp'
    );
  });

  test('работает с разными категориями', () => {
    expect(getUserImageUrl('article_img', 'articles')).toBe(
      '/images/users/zhoock/articles/article_img.jpg'
    );
    expect(getUserImageUrl('avatar', 'profile', '.png')).toBe(
      '/images/users/zhoock/profile/avatar.png'
    );
  });
});

describe('formatDate', () => {
  test('форматирует ISO дату в dd/mm/yyyy', () => {
    const iso = '2024-01-05T12:34:56Z';
    expect(formatDate(iso)).toBe('05/01/2024');
  });
});
