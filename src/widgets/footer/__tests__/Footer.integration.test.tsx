import { describe, test, expect } from '@jest/globals';
import { screen } from '@testing-library/react';
import { Footer } from '../ui/Footer';
import { renderWithProviders } from '@shared/lib/test-utils';

describe('Footer integration tests', () => {
  test('должен отобразить все социальные сети', () => {
    renderWithProviders(<Footer />, {
      preloadedState: {
        lang: { current: 'en' },
        uiDictionary: {
          en: {
            status: 'succeeded',
            error: null,
            data: [
              {
                menu: {},
                buttons: {},
                titles: {
                  support: 'Support',
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

    expect(screen.getByRole('link', { name: /youtube/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /instagram/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /facebook/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /vk/i })).toBeInTheDocument();
  });

  test('должен отобразить ссылки с правильными href', () => {
    renderWithProviders(<Footer />, {
      preloadedState: {
        lang: { current: 'en' },
        uiDictionary: {
          en: {
            status: 'succeeded',
            error: null,
            data: [
              {
                menu: {},
                buttons: {},
                titles: {
                  support: 'Support',
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

    const youtubeLink = screen.getByRole('link', { name: /youtube/i });
    expect(youtubeLink).toHaveAttribute(
      'href',
      'https://www.youtube.com/channel/UC1Ok67ewgn1Wg2PF42rDxoA/'
    );
    expect(youtubeLink).toHaveAttribute('target', '_blank');
    expect(youtubeLink).toHaveAttribute('rel', 'noopener noreferrer');
  });

  test('должен отобразить копирайт', () => {
    renderWithProviders(<Footer />, {
      preloadedState: {
        lang: { current: 'en' },
        uiDictionary: {
          en: {
            status: 'succeeded',
            error: null,
            data: [
              {
                menu: {},
                buttons: {},
                titles: {
                  support: 'Support',
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

    expect(screen.getByText(/© 2021—2025 Смоляное чучелко/i)).toBeInTheDocument();
  });

  test('должен отобразить ссылку поддержки из UI словаря', () => {
    renderWithProviders(<Footer />, {
      preloadedState: {
        lang: { current: 'en' },
        uiDictionary: {
          en: {
            status: 'succeeded',
            error: null,
            data: [
              {
                menu: {},
                buttons: {},
                titles: {
                  support: 'Support',
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

    const supportLink = screen.getByRole('link', { name: /support/i });
    expect(supportLink).toBeInTheDocument();
    expect(supportLink).toHaveAttribute('href', 'mailto:feedback@smolyanoechuchelko.ru');
  });

  test('должен использовать fallback текст если UI словарь не загружен', () => {
    renderWithProviders(<Footer />, {
      preloadedState: {
        lang: { current: 'en' },
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

    const supportLink = screen.getByRole('link', { name: /поддержка/i });
    expect(supportLink).toBeInTheDocument();
  });

  test('должен иметь role="contentinfo" для footer', () => {
    const { container } = renderWithProviders(<Footer />, {
      preloadedState: {
        lang: { current: 'en' },
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

    const footer = container.querySelector('footer[role="contentinfo"]');
    expect(footer).toBeInTheDocument();
  });
});
