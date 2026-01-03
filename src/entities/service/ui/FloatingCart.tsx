import React, { useState, useEffect } from 'react';
import { useCart } from '../model/CartContext';
import { PurchasePopup } from './PurchasePopup';
import AlbumCover from '@entities/album/ui/AlbumCover';
import { useLang } from '@app/providers/lang';
import { useAppSelector } from '@shared/lib/hooks/useAppSelector';
import { selectUiDictionaryFirst } from '@shared/model/uiDictionary';
import './FloatingCart.style.scss';

export function FloatingCart() {
  const { cartAlbums, removeFromCart, isCartEmpty, cartItemsCount } = useCart();
  const [isPurchasePopupOpen, setIsPurchasePopupOpen] = useState(false);
  const { lang } = useLang();
  const ui = useAppSelector((state) => selectUiDictionaryFirst(state, lang));
  const t = ui || null;

  // Закрываем попап, если корзина становится пустой
  useEffect(() => {
    if (isCartEmpty || cartAlbums.length === 0) {
      setIsPurchasePopupOpen(false);
    }
  }, [isCartEmpty, cartAlbums.length]);

  const handleCartClick = () => {
    if (!isCartEmpty) {
      setIsPurchasePopupOpen(true);
    }
  };

  const handleClosePopup = () => {
    setIsPurchasePopupOpen(false);
  };

  const handleContinueShopping = () => {
    setIsPurchasePopupOpen(false);
  };

  const handleRegister = () => {
    // TODO: Реализовать переход на регистрацию/оформление заказа
    console.log('Register for checkout');
  };

  // Не отображаем, если корзина пуста
  if (isCartEmpty || cartAlbums.length === 0) {
    return null;
  }

  // Показываем максимум 3 обложки наложенных друг на друга
  const maxVisibleCovers = 3;
  const albumsWithCovers = cartAlbums.filter((album) => album.cover);
  const albumsToShow = albumsWithCovers.slice(0, maxVisibleCovers);
  const hasMoreAlbums = albumsWithCovers.length > maxVisibleCovers;
  const hasAnyCover = albumsWithCovers.length > 0;

  return (
    <>
      <button
        type="button"
        className="floating-cart"
        onClick={handleCartClick}
        aria-label="Открыть корзину"
      >
        {hasAnyCover && cartAlbums.length > 1 ? (
          <div className="floating-cart__thumbnails-stack">
            {albumsToShow.map((album, index) => (
              <div
                key={album.albumId || index}
                className="floating-cart__thumbnail-stack-item"
                style={{ '--stack-index': index } as React.CSSProperties}
              >
                <AlbumCover
                  img={album.cover!}
                  fullName={album.fullName}
                  size={56}
                  densities={[1, 2]}
                  sizes="56px"
                />
              </div>
            ))}
            {hasMoreAlbums && (
              <div
                className="floating-cart__thumbnail-stack-item floating-cart__thumbnail-stack-item--more"
                style={{ '--stack-index': maxVisibleCovers } as React.CSSProperties}
              >
                <div className="floating-cart__thumbnail-stack-item-overlay">
                  +{albumsWithCovers.length - maxVisibleCovers}
                </div>
              </div>
            )}
          </div>
        ) : hasAnyCover ? (
          <div className="floating-cart__thumbnail">
            <AlbumCover
              img={cartAlbums[0].cover!}
              fullName={cartAlbums[0].fullName}
              size={56}
              densities={[1, 2]}
              sizes="56px"
            />
          </div>
        ) : (
          <div className="floating-cart__icon">
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <circle cx="9" cy="21" r="1" />
              <circle cx="20" cy="21" r="1" />
              <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" />
            </svg>
          </div>
        )}
        <div className="floating-cart__badge">{cartItemsCount}</div>
      </button>

      {cartAlbums.length > 0 && (
        <PurchasePopup
          isOpen={isPurchasePopupOpen}
          albums={cartAlbums}
          onClose={handleClosePopup}
          onRemove={removeFromCart}
          onContinueShopping={handleContinueShopping}
          onRegister={handleRegister}
        />
      )}
    </>
  );
}
