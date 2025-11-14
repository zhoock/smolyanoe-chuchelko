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

  test('должен отобразить заголовок "Страница не найдена"', () => {
    renderWithProviders(<NotFoundPage />, {
      preloadedState: {
        lang: { current: 'en' },
      },
    });

    expect(screen.getByText('Страница не найдена')).toBeInTheDocument();
  });

  test('должен отобразить SVG логотип с правильными aria-атрибутами', () => {
    renderWithProviders(<NotFoundPage />, {
      preloadedState: {
        lang: { current: 'en' },
      },
    });

    const logo = screen.getByRole('img', { name: /smolyanoe chuchelko — logo/i });
    expect(logo).toBeInTheDocument();
    expect(logo).toHaveAttribute('aria-labelledby', 't d');
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

  test('должен отобразить описание логотипа', () => {
    renderWithProviders(<NotFoundPage />, {
      preloadedState: {
        lang: { current: 'en' },
      },
    });

    const description = screen.getByText(
      /двухцветный силуэт головы с пустыми глазами, разрезом рта и «соломой» наверху/i
    );
    expect(description).toBeInTheDocument();
  });
});
