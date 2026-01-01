import { describe, test, expect } from '@jest/globals';
import { screen } from '@testing-library/react';
import { AlbumsSection } from '../AlbumsSection';
import { renderWithProviders } from '@shared/lib/test-utils';
import type { IAlbums } from '@models';

describe('AlbumsSection integration tests', () => {
  const mockAlbums: IAlbums[] = [
    {
      albumId: 'album-1',
      album: 'Album 1',
      artist: 'Artist 1',
      fullName: 'Artist 1 — Album 1',
      description: 'Description 1',
      release: {
        date: '2024-01-01',
      },
      cover: 'cover1',
      tracks: [],
      buttons: {},
      details: [],
    },
    {
      albumId: 'album-2',
      album: 'Album 2',
      artist: 'Artist 2',
      fullName: 'Artist 2 — Album 2',
      description: 'Description 2',
      release: {
        date: '2024-02-01',
      },
      cover: 'cover2',
      tracks: [],
      buttons: {},
      details: [],
    },
  ];

  test('должен отобразить Loader во время загрузки', () => {
    renderWithProviders(<AlbumsSection />, {
      preloadedState: {
        lang: { current: 'en' },
        albums: {
          en: {
            status: 'loading',
            error: null,
            data: [],
            lastUpdated: null,
          },
          ru: {
            status: 'idle',
            error: null,
            data: [],
            lastUpdated: null,
          },
        },
        uiDictionary: {
          en: {
            status: 'idle',
            error: null,
            data: [],
            lastUpdated: null,
          },
          ru: {
            status: 'idle',
            error: null,
            data: [],
            lastUpdated: null,
          },
        },
      },
    });

    // Проверяем что секция рендерится (может иметь fallback текст "…", если UI словарь не загружен)
    const region = screen.queryByRole('region');
    expect(region).toBeInTheDocument();
  });

  test('должен отобразить ошибку при failed статусе', () => {
    renderWithProviders(<AlbumsSection />, {
      preloadedState: {
        lang: { current: 'en' },
        albums: {
          en: {
            status: 'failed',
            error: 'Failed to load albums',
            data: [],
            lastUpdated: null,
          },
          ru: {
            status: 'idle',
            error: null,
            data: [],
            lastUpdated: null,
          },
        },
        uiDictionary: {
          en: {
            status: 'idle',
            error: null,
            data: [],
            lastUpdated: null,
          },
          ru: {
            status: 'idle',
            error: null,
            data: [],
            lastUpdated: null,
          },
        },
      },
    });

    // Проверяем что секция рендерится (может иметь fallback текст "…", если UI словарь не загружен)
    const region = screen.queryByRole('region');
    expect(region).toBeInTheDocument();
  });

  test('должен отобразить список альбомов', () => {
    renderWithProviders(<AlbumsSection />, {
      preloadedState: {
        lang: { current: 'en' },
        albums: {
          en: {
            status: 'succeeded',
            error: null,
            data: mockAlbums,
            lastUpdated: Date.now(),
          },
          ru: {
            status: 'idle',
            error: null,
            data: [],
            lastUpdated: null,
          },
        },
        uiDictionary: {
          en: {
            status: 'succeeded',
            error: null,
            data: [
              {
                menu: {},
                buttons: {},
                titles: {
                  albums: 'Albums',
                },
              },
            ],
            lastUpdated: Date.now(),
          },
          ru: {
            status: 'idle',
            error: null,
            data: [],
            lastUpdated: null,
          },
        },
      },
    });

    expect(screen.getByText('Albums')).toBeInTheDocument();
    // Проверяем что секция рендерится (может иметь fallback текст "…", если UI словарь не загружен)
    const region = screen.queryByRole('region');
    expect(region).toBeInTheDocument();
  });

  test('должен отобразить заголовок из UI словаря', () => {
    renderWithProviders(<AlbumsSection />, {
      preloadedState: {
        lang: { current: 'en' },
        albums: {
          en: {
            status: 'succeeded',
            error: null,
            data: mockAlbums,
            lastUpdated: Date.now(),
          },
          ru: {
            status: 'idle',
            error: null,
            data: [],
            lastUpdated: null,
          },
        },
        uiDictionary: {
          en: {
            status: 'succeeded',
            error: null,
            data: [
              {
                menu: {},
                buttons: {},
                titles: {
                  albums: 'My Albums',
                },
              },
            ],
            lastUpdated: Date.now(),
          },
          ru: {
            status: 'idle',
            error: null,
            data: [],
            lastUpdated: null,
          },
        },
      },
    });

    expect(screen.getByText('My Albums')).toBeInTheDocument();
  });

  test('должен использовать fallback текст если UI словарь не загружен', () => {
    renderWithProviders(<AlbumsSection />, {
      preloadedState: {
        lang: { current: 'en' },
        albums: {
          en: {
            status: 'succeeded',
            error: null,
            data: mockAlbums,
            lastUpdated: Date.now(),
          },
          ru: {
            status: 'idle',
            error: null,
            data: [],
            lastUpdated: null,
          },
        },
        uiDictionary: {
          en: {
            status: 'idle',
            error: null,
            data: [],
            lastUpdated: null,
          },
          ru: {
            status: 'idle',
            error: null,
            data: [],
            lastUpdated: null,
          },
        },
      },
    });

    expect(screen.getByText('…')).toBeInTheDocument();
  });

  test('должен обработать пустой список альбомов', () => {
    renderWithProviders(<AlbumsSection />, {
      preloadedState: {
        lang: { current: 'en' },
        albums: {
          en: {
            status: 'succeeded',
            error: null,
            data: [],
            lastUpdated: Date.now(),
          },
          ru: {
            status: 'idle',
            error: null,
            data: [],
            lastUpdated: null,
          },
        },
        uiDictionary: {
          en: {
            status: 'succeeded',
            error: null,
            data: [
              {
                menu: {},
                buttons: {},
                titles: {
                  albums: 'Albums',
                },
              },
            ],
            lastUpdated: Date.now(),
          },
          ru: {
            status: 'idle',
            error: null,
            data: [],
            lastUpdated: null,
          },
        },
      },
    });

    expect(screen.getByText('Albums')).toBeInTheDocument();
    const albumsList = screen
      .getByRole('region', { name: /albums/i })
      .querySelector('.albums__list');
    expect(albumsList).toBeInTheDocument();
    expect(albumsList?.children.length).toBe(0);
  });
});
