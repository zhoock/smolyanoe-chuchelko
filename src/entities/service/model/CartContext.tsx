import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  ReactNode,
} from 'react';
import type { IAlbums } from '@models';

interface CartContextType {
  cartAlbums: IAlbums[];
  addToCart: (album: IAlbums) => void;
  removeFromCart: (albumId: string) => void;
  clearCart: () => void;
  isCartEmpty: boolean;
  cartItemsCount: number;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

const CART_STORAGE_KEY = 'cartAlbums';

/**
 * Загружает корзину из localStorage
 */
function loadCartFromStorage(): IAlbums[] {
  try {
    if (typeof window === 'undefined') return [];
    const stored = localStorage.getItem(CART_STORAGE_KEY);
    if (!stored) return [];
    const parsed = JSON.parse(stored);
    // Валидация: проверяем, что это массив
    if (!Array.isArray(parsed)) return [];
    // Валидация: проверяем, что каждый элемент имеет необходимые поля
    return parsed.filter((item) => item && typeof item === 'object' && item.albumId);
  } catch (error) {
    console.warn('Failed to load cart from localStorage:', error);
    return [];
  }
}

/**
 * Сохраняет корзину в localStorage
 */
function saveCartToStorage(albums: IAlbums[]): void {
  try {
    if (typeof window === 'undefined') return;
    localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(albums));
  } catch (error) {
    console.warn('Failed to save cart to localStorage:', error);
  }
}

export function CartProvider({ children }: { children: ReactNode }) {
  // Инициализируем состояние из localStorage
  const [cartAlbums, setCartAlbums] = useState<IAlbums[]>(() => loadCartFromStorage());

  // Сохраняем корзину в localStorage при каждом изменении
  useEffect(() => {
    saveCartToStorage(cartAlbums);
  }, [cartAlbums]);

  const addToCart = useCallback((album: IAlbums) => {
    setCartAlbums((prevAlbums) => {
      // Проверяем, есть ли уже такой альбом в корзине (по albumId)
      if (album.albumId && prevAlbums.some((a) => a.albumId === album.albumId)) {
        return prevAlbums; // Альбом уже в корзине, не добавляем повторно
      }
      const newAlbums = [...prevAlbums, album];
      return newAlbums;
    });
  }, []);

  const removeFromCart = useCallback((albumId: string) => {
    setCartAlbums((prevAlbums) => prevAlbums.filter((a) => a.albumId !== albumId));
  }, []);

  const clearCart = useCallback(() => {
    setCartAlbums([]);
  }, []);

  const isCartEmpty = cartAlbums.length === 0;
  const cartItemsCount = cartAlbums.length;

  return (
    <CartContext.Provider
      value={{
        cartAlbums,
        addToCart,
        removeFromCart,
        clearCart,
        isCartEmpty,
        cartItemsCount,
      }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const context = useContext(CartContext);
  if (context === undefined) {
    throw new Error('useCart must be used within a CartProvider');
  }
  return context;
}
