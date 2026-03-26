import { describe, test, expect, beforeEach } from '@jest/globals';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NotFoundPage } from '../NotFoundPage';
import { renderWithProviders } from '@shared/lib/test-utils';

// Мокируем useNavigate
const mockNavigate = jest.fn();

jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: () => mockNavigate,
}));

describe('NotFoundPage integration tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('должен отобразить иллюстрацию 404', () => {
    renderWithProviders(<NotFoundPage />, {
      preloadedState: {
        lang: { current: 'en' },
      },
    });

    expect(screen.getByRole('img', { name: /404 - страница не найдена/i })).toBeInTheDocument();
  });

  test('должен отобразить 404 изображение', () => {
    renderWithProviders(<NotFoundPage />, {
      preloadedState: {
        lang: { current: 'en' },
      },
    });

    const logo = screen.getByRole('img', { name: /404 - страница не найдена/i });
    expect(logo).toBeInTheDocument();
    expect(logo).toHaveAttribute('src', '/images/users/zhoock/tarbaby/404.png');
  });

  test('должен отобразить кнопку "Вернуться на главную"', () => {
    renderWithProviders(<NotFoundPage />, {
      preloadedState: {
        lang: { current: 'en' },
      },
    });

    const button = screen.getByRole('button', { name: /вернуться на главную/i });
    expect(button).toBeInTheDocument();
  });

  test('должен вызвать navigate при клике на кнопку', async () => {
    const user = userEvent.setup();
    renderWithProviders(<NotFoundPage />, {
      preloadedState: {
        lang: { current: 'en' },
      },
    });

    const button = screen.getByRole('button', { name: /вернуться на главную/i });
    await user.click(button);

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/', { replace: true });
    });
  });

  test('должен отобразить кнопку возврата', () => {
    renderWithProviders(<NotFoundPage />, {
      preloadedState: {
        lang: { current: 'en' },
      },
    });

    expect(screen.getByRole('button', { name: /вернуться на главную/i })).toBeInTheDocument();
  });
});
