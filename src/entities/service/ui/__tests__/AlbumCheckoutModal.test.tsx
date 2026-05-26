/**
 * UI-тесты для нового прямого album-checkout flow.
 *
 * Покрывают переход с cart-based UX на single-step checkout:
 *  - валидация формы блокирует createPayment
 *  - валидный submit идёт в createPayment с правильными аргументами
 *  - ошибка createPayment остаётся в форме (не редиректит)
 *  - ownership branch: уже куплено → форма скрыта, виден Download
 *  - пре-заполнение email/имени из auth-сессии
 *  - defensive: album=null не рендерит ничего
 *
 * Сам редирект (`window.location.href = ...`) проверять в jsdom неудобно
 * (location read-only) — ограничиваемся проверкой, что createPayment был
 * вызван с правильным returnUrl/payload.
 */

import React from 'react';
import { describe, test, expect, jest, beforeEach } from '@jest/globals';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import { renderWithProviders } from '@shared/lib/test-utils';
import type { IAlbums } from '@models';

type CreatePaymentResult = {
  success: boolean;
  confirmationUrl?: string;
  orderId?: string;
  error?: string;
};

const createPaymentMock = jest.fn<(...args: unknown[]) => Promise<CreatePaymentResult>>();
jest.mock('@shared/api/payment', () => ({
  createPayment: (...args: unknown[]) => createPaymentMock(...args),
}));

const downloadOwnedAlbumZipByAuthMock = jest.fn<(...args: unknown[]) => Promise<void>>();
jest.mock('@shared/api/purchases', () => ({
  downloadOwnedAlbumZipByAuth: (...args: unknown[]) => downloadOwnedAlbumZipByAuthMock(...args),
}));

const ownershipState: {
  isOwned: boolean;
  ownedPurchase: { tracks: { trackId: string; title: string }[] } | null;
} = {
  isOwned: false,
  ownedPurchase: null,
};
jest.mock('@entities/service/lib/useAlbumOwnedByViewer', () => ({
  useAlbumOwnedByViewer: () => ownershipState,
}));

let mockUser: { id: string; email: string; name?: string } | null = null;
jest.mock('@shared/lib/auth', () => ({
  getUser: () => mockUser,
}));

jest.mock('@shared/lib/hooks/useSiteArtistDisplayName', () => ({
  useSiteArtistDisplayName: () => ({
    displayName: 'Test Artist',
    displayLabel: 'TEST ARTIST',
  }),
}));

jest.mock('@entities/album/ui/AlbumCover', () => ({
  __esModule: true,
  default: () => null,
}));

import { AlbumCheckoutModal } from '../AlbumCheckoutModal';

const testAlbum = {
  albumId: 'album-1',
  album: 'Sample Album',
  artist: 'Test Artist',
  cover: null,
  userId: 'user-1',
  release: { regularPrice: '4.99', currency: 'RUB', allowDownloadSale: 'yes' },
  tracks: [
    { id: 1, title: 'Track A' },
    { id: 2, title: 'Track B' },
  ],
  buttons: {},
} as unknown as IAlbums;

function fillValidForm() {
  fireEvent.change(screen.getByLabelText(/email/i), {
    target: { value: 'fan@example.com' },
  });
  fireEvent.change(screen.getByLabelText(/first name|имя/i), {
    target: { value: 'Pat' },
  });
  fireEvent.change(screen.getByLabelText(/last name|фамилия/i), {
    target: { value: 'Doe' },
  });
  const checkboxes = screen.getAllByRole('checkbox');
  checkboxes.forEach((cb) => fireEvent.click(cb));
}

beforeEach(() => {
  createPaymentMock.mockReset();
  downloadOwnedAlbumZipByAuthMock.mockReset();
  ownershipState.isOwned = false;
  ownershipState.ownedPurchase = null;
  mockUser = null;
});

describe('AlbumCheckoutModal', () => {
  test('renders album hero (title, artist, price) when open', () => {
    renderWithProviders(<AlbumCheckoutModal isOpen album={testAlbum} onClose={() => {}} />);

    expect(screen.getByText('Sample Album')).toBeInTheDocument();
    expect(screen.getByText('TEST ARTIST')).toBeInTheDocument();
    expect(screen.getByText('4.99 ₽')).toBeInTheDocument();
  });

  test('blocks submit and surfaces validation errors when form is empty', async () => {
    renderWithProviders(<AlbumCheckoutModal isOpen album={testAlbum} onClose={() => {}} />);

    const submit = screen.getByRole('button', {
      name: /continue to payment|перейти к оплате/i,
    });
    fireEvent.click(submit);

    await waitFor(() => {
      expect(screen.getByText(/email is required|введите email/i)).toBeInTheDocument();
    });
    expect(createPaymentMock).not.toHaveBeenCalled();
  });

  test('valid submit calls createPayment with album + customer details', async () => {
    // Никогда не резолвим — чтобы тест не пытался выполнить редирект на
    // confirmationUrl и не нарваться на jsdom location-восстановление.
    createPaymentMock.mockImplementation(() => new Promise(() => {}));

    renderWithProviders(<AlbumCheckoutModal isOpen album={testAlbum} onClose={() => {}} />);

    fillValidForm();
    fireEvent.click(screen.getByRole('button', { name: /continue to payment|перейти к оплате/i }));

    await waitFor(() => {
      expect(createPaymentMock).toHaveBeenCalledTimes(1);
    });

    const payload = createPaymentMock.mock.calls[0][0] as Record<string, unknown>;
    expect(payload).toMatchObject({
      amount: 4.99,
      currency: 'RUB',
      albumId: 'album-1',
      customerEmail: 'fan@example.com',
      billingData: { firstName: 'Pat', lastName: 'Doe' },
    });
    expect(typeof payload.returnUrl).toBe('string');
    expect(payload.returnUrl).toContain('/pay/success?returnTo=');
  });

  test('surfaces createPayment error and stays on form', async () => {
    createPaymentMock.mockResolvedValueOnce({
      success: false,
      error: 'YooKassa unavailable',
    });

    renderWithProviders(<AlbumCheckoutModal isOpen album={testAlbum} onClose={() => {}} />);

    fillValidForm();
    fireEvent.click(screen.getByRole('button', { name: /continue to payment|перейти к оплате/i }));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('YooKassa unavailable');
    });
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
  });

  test('prefills email and split name from auth session', () => {
    mockUser = { id: 'u1', email: 'me@example.com', name: 'Anna Smith' };

    renderWithProviders(<AlbumCheckoutModal isOpen album={testAlbum} onClose={() => {}} />);

    expect(screen.getByLabelText(/email/i)).toHaveValue('me@example.com');
    expect(screen.getByLabelText(/first name|имя/i)).toHaveValue('Anna');
    expect(screen.getByLabelText(/last name|фамилия/i)).toHaveValue('Smith');
  });

  test('shows already-owned state and download CTA when isOwned=true', async () => {
    ownershipState.isOwned = true;
    ownershipState.ownedPurchase = {
      tracks: [
        { trackId: '1', title: 'Track A' },
        { trackId: '2', title: 'Track B' },
      ],
    };
    downloadOwnedAlbumZipByAuthMock.mockResolvedValueOnce();

    renderWithProviders(<AlbumCheckoutModal isOpen album={testAlbum} onClose={() => {}} />);

    expect(
      screen.getByRole('heading', {
        name: /already in your library|уже в вашей библиотеке/i,
      })
    ).toBeInTheDocument();
    expect(screen.queryByLabelText(/email/i)).not.toBeInTheDocument();
    expect(createPaymentMock).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: /download album|скачать альбом/i }));

    await waitFor(() => {
      expect(downloadOwnedAlbumZipByAuthMock).toHaveBeenCalledTimes(1);
    });
    const downloadArgs = downloadOwnedAlbumZipByAuthMock.mock.calls[0][0] as Record<
      string,
      unknown
    >;
    expect(downloadArgs).toMatchObject({
      albumId: 'album-1',
      artist: 'Test Artist',
      album: 'Sample Album',
    });
  });

  test('renders nothing when album is null (defensive)', () => {
    const { container } = renderWithProviders(
      <AlbumCheckoutModal isOpen album={null} onClose={() => {}} />
    );
    expect(container).toBeEmptyDOMElement();
  });
});
