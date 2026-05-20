import type { IAlbums } from '@models';

export type AlbumPriceInfo = {
  price: string;
  currency: string;
  formatted: string;
};

export function getAlbumPrice(album: IAlbums): AlbumPriceInfo {
  const release = album.release && typeof album.release === 'object' ? album.release : {};
  const regularPrice = (release as { regularPrice?: string }).regularPrice || '0.99';
  const currency = (release as { currency?: string }).currency || 'USD';

  const priceNum = parseFloat(regularPrice) || 0;
  const formattedPrice = priceNum.toFixed(2);

  let formatted = '';
  switch (currency.toUpperCase()) {
    case 'RUB':
      formatted = `${formattedPrice} ₽`;
      break;
    case 'EUR':
      formatted = `€${formattedPrice}`;
      break;
    case 'USD':
      formatted = `$${formattedPrice}`;
      break;
    default:
      formatted = `${currency.toUpperCase()}${formattedPrice}`;
  }

  return {
    price: regularPrice,
    currency,
    formatted,
  };
}
