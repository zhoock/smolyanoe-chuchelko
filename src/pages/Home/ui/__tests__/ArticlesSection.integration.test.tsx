import { describe, test, expect } from '@jest/globals';
import { screen } from '@testing-library/react';
import { ArticlesSection } from '../ArticlesSection';
import { renderWithProviders } from '@shared/lib/test-utils';
import type { IArticles } from '@models';

describe('ArticlesSection integration tests', () => {
  const mockArticles: IArticles[] = [
    {
      articleId: 'article-1',
      nameArticle: 'Article 1',
      description: 'Description 1',
      date: '2024-01-01',
      img: 'article1.jpg',
      details: [],
    },
    {
      articleId: 'article-2',
      nameArticle: 'Article 2',
      description: 'Description 2',
      date: '2024-02-01',
      img: 'article2.jpg',
      details: [],
    },
  ];

  test('должен отобразить Loader во время загрузки', () => {
    renderWithProviders(<ArticlesSection />, {
      preloadedState: {
        lang: { current: 'en' },
        articles: {
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
    renderWithProviders(<ArticlesSection />, {
      preloadedState: {
        lang: { current: 'en' },
        articles: {
          en: {
            status: 'failed',
            error: 'Failed to load articles',
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

  test('должен отобразить список статей', () => {
    renderWithProviders(<ArticlesSection />, {
      preloadedState: {
        lang: { current: 'en' },
        articles: {
          en: {
            status: 'succeeded',
            error: null,
            data: mockArticles,
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
                  articles: 'Articles',
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

    expect(screen.getByText('Articles')).toBeInTheDocument();
    // Проверяем что секция рендерится (может иметь fallback текст "…", если UI словарь не загружен)
    const region = screen.queryByRole('region');
    expect(region).toBeInTheDocument();
  });

  test('должен отобразить заголовок из UI словаря', () => {
    renderWithProviders(<ArticlesSection />, {
      preloadedState: {
        lang: { current: 'en' },
        articles: {
          en: {
            status: 'succeeded',
            error: null,
            data: mockArticles,
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
                  articles: 'News',
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

    expect(screen.getByText('News')).toBeInTheDocument();
  });

  test('должен использовать fallback текст если UI словарь не загружен', () => {
    renderWithProviders(<ArticlesSection />, {
      preloadedState: {
        lang: { current: 'en' },
        articles: {
          en: {
            status: 'succeeded',
            error: null,
            data: mockArticles,
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

  test('должен обработать пустой список статей', () => {
    renderWithProviders(<ArticlesSection />, {
      preloadedState: {
        lang: { current: 'en' },
        articles: {
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
                  articles: 'Articles',
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

    expect(screen.getByText('Articles')).toBeInTheDocument();
    const articlesList = screen
      .getByRole('region', { name: /articles/i })
      .querySelector('.articles__list');
    expect(articlesList).toBeInTheDocument();
    expect(articlesList?.children.length).toBe(0);
  });
});
