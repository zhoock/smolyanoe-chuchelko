import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Popup } from '@shared/ui/popup';
import type { IAlbums } from '@models';
import AlbumCover from '@entities/album/ui/AlbumCover';
import { createPayment } from '@shared/api/payment';
import { useLang } from '@app/providers/lang';
import { useAppSelector } from '@shared/lib/hooks/useAppSelector';
import { selectUiDictionaryFirst } from '@shared/model/uiDictionary';
import { getUser } from '@shared/lib/auth';
import { useCart } from '../model/CartContext';
import './PurchasePopup.style.scss';

type Step = 'cart' | 'checkout';

// Утилита для получения цены и валюты из альбома
const getAlbumPrice = (album: IAlbums): { price: string; currency: string; formatted: string } => {
  const release = album.release && typeof album.release === 'object' ? album.release : {};
  const regularPrice = (release as any).regularPrice || '0.99';
  const currency = (release as any).currency || 'USD';

  // Форматируем цену с символом валюты
  const priceNum = parseFloat(regularPrice) || 0;
  const formattedPrice = priceNum.toFixed(2);

  // Определяем символ валюты и форматируем цену
  let formatted = '';
  switch (currency.toUpperCase()) {
    case 'RUB':
      // Для рубля символ ставится после цены
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
    currency: currency,
    formatted: formatted,
  };
};

// Валидация
interface ValidationErrors {
  [key: string]: string;
}

const createValidators = (t: any) => ({
  validateEmail: (email: string): string => {
    if (!email) return t?.checkout?.validation?.emailRequired || 'Email is required';
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email))
      return t?.checkout?.validation?.emailInvalid || 'Please enter a valid email address';
    return '';
  },

  validateRequired: (value: string, fieldName: string): string => {
    if (!value.trim()) {
      if (fieldName === 'First name')
        return t?.checkout?.validation?.firstNameRequired || 'First name is required';
      if (fieldName === 'Last name')
        return t?.checkout?.validation?.lastNameRequired || 'Last name is required';
      if (fieldName === 'ZIP code')
        return t?.checkout?.validation?.zipCodeRequired || 'ZIP code is required';
      if (fieldName === 'Mobile')
        return t?.checkout?.validation?.mobileRequired || 'Mobile is required';
      return `${fieldName} is required`;
    }
    return '';
  },
});

interface PurchasePopupProps {
  isOpen: boolean;
  albums: IAlbums[];
  onClose: () => void;
  onRemove: (albumId: string) => void;
  onContinueShopping: () => void;
  onRegister: () => void;
}

function CartStep({
  albums,
  onRemove,
  onContinueShopping,
  onCheckout,
  t,
}: {
  albums: IAlbums[];
  onRemove: (albumId: string) => void;
  onContinueShopping: () => void;
  onCheckout: () => void;
  t: any;
}) {
  // Вычисляем общую стоимость
  const totalPrice = albums.reduce((sum, album) => {
    const { price } = getAlbumPrice(album);
    return sum + (parseFloat(price) || 0);
  }, 0);

  // Получаем валюту из первого альбома
  const firstAlbumCurrency = albums[0] ? getAlbumPrice(albums[0]).currency : 'USD';

  // Форматируем общую цену
  const formattedTotalPrice = totalPrice.toFixed(2);
  let formattedTotal = '';
  switch (firstAlbumCurrency.toUpperCase()) {
    case 'RUB':
      formattedTotal = `${formattedTotalPrice} ₽`;
      break;
    case 'EUR':
      formattedTotal = `€${formattedTotalPrice}`;
      break;
    case 'USD':
      formattedTotal = `$${formattedTotalPrice}`;
      break;
    default:
      formattedTotal = `${formattedTotalPrice} ${firstAlbumCurrency}`;
  }

  return (
    <>
      <h2 className="purchase-popup__title">{t?.checkout?.cart?.title || 'Your cart'}</h2>

      <div className="purchase-popup__divider" />

      {albums.map((album) => {
        const { formatted: formattedPrice } = getAlbumPrice(album);
        return (
          <React.Fragment key={album.albumId || album.album}>
            <div className="purchase-popup__item">
              <div className="purchase-popup__item-thumbnail">
                {album?.cover ? (
                  <AlbumCover
                    img={album.cover}
                    fullName={album.fullName}
                    size={64}
                    densities={[1, 2]}
                    sizes="80px"
                  />
                ) : (
                  <div className="purchase-popup__item-thumbnail-placeholder" aria-hidden="true" />
                )}
              </div>

              <div className="purchase-popup__item-details">
                <div className="purchase-popup__item-title">{album.album}</div>
                <div className="purchase-popup__item-type">
                  {t?.checkout?.cart?.albumDownload || 'Album download'}
                </div>
                <div className="purchase-popup__item-actions">
                  <span className="purchase-popup__item-quantity">1</span>
                  <button
                    type="button"
                    className="purchase-popup__item-remove"
                    onClick={() => album.albumId && onRemove(album.albumId)}
                    aria-label={t?.checkout?.cart?.remove || 'Remove item'}
                  >
                    {t?.checkout?.cart?.remove || 'Remove'}
                  </button>
                </div>
              </div>

              <div className="purchase-popup__item-price">{formattedPrice}</div>
            </div>
            <div className="purchase-popup__divider" />
          </React.Fragment>
        );
      })}

      <div className="purchase-popup__summary">
        <div className="purchase-popup__subtotal">
          {t?.checkout?.cart?.subtotal || 'Subtotal'} <span>{formattedTotal}</span>
        </div>

        <button
          type="button"
          className="purchase-popup__button purchase-popup__button--checkout"
          onClick={onCheckout}
          aria-label={t?.checkout?.cart?.checkout || 'Checkout'}
        >
          {t?.checkout?.cart?.checkout || 'CHECKOUT'}
        </button>

        <button
          type="button"
          className="purchase-popup__button purchase-popup__button--continue"
          onClick={onContinueShopping}
          aria-label={t?.checkout?.cart?.continueShopping || 'Continue shopping'}
        >
          {t?.checkout?.cart?.continueShopping || 'Continue shopping'}
        </button>
      </div>
    </>
  );
}

interface CheckoutFormData {
  email: string;
  firstName: string;
  lastName: string;
  notes: string;
  joinMailingList: boolean;
  agreeToOffer: boolean;
  agreeToPrivacy: boolean;
}

function CheckoutStep({
  album,
  onBackToCart,
  formData,
  onFormDataChange,
  t,
}: {
  album: IAlbums;
  onBackToCart: () => void;
  formData: CheckoutFormData;
  onFormDataChange: (data: CheckoutFormData) => void;
  t: any;
}) {
  const { clearCart } = useCart();
  const [email, setEmail] = useState(formData.email);
  const [firstName, setFirstName] = useState(formData.firstName);
  const [lastName, setLastName] = useState(formData.lastName);
  const [notes, setNotes] = useState(formData.notes);
  const [joinMailingList, setJoinMailingList] = useState(formData.joinMailingList);
  const [agreeToOffer, setAgreeToOffer] = useState(formData.agreeToOffer);
  const [agreeToPrivacy, setAgreeToPrivacy] = useState(formData.agreeToPrivacy);
  const [discountCode, setDiscountCode] = useState('');
  const [errors, setErrors] = useState<ValidationErrors>({});
  const [isPaymentLoading, setIsPaymentLoading] = useState(false);
  const [paymentError, setPaymentError] = useState<string | null>(null);
  const { price, currency: albumCurrency, formatted: formattedPrice } = getAlbumPrice(album);
  const total = parseFloat(price) || 0.99;

  const validators = createValidators(t);

  const validateForm = (): boolean => {
    const newErrors: ValidationErrors = {};

    const emailError = validators.validateEmail(email);
    if (emailError) newErrors.email = emailError;

    const firstNameError = validators.validateRequired(firstName, 'First name');
    if (firstNameError) newErrors.firstName = firstNameError;

    const lastNameError = validators.validateRequired(lastName, 'Last name');
    if (lastNameError) newErrors.lastName = lastNameError;

    if (!agreeToOffer) {
      newErrors.agreeToOffer =
        t?.checkout?.validation?.agreeToOfferRequired || 'You must agree to the offer';
    }

    if (!agreeToPrivacy) {
      newErrors.agreeToPrivacy =
        t?.checkout?.validation?.agreeToPrivacyRequired || 'You must agree to the privacy policy';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handlePayment = async () => {
    if (!validateForm()) {
      return;
    }

    // Сохраняем данные формы
    onFormDataChange({
      email,
      firstName,
      lastName,
      notes,
      joinMailingList,
      agreeToOffer,
      agreeToPrivacy,
    });

    setIsPaymentLoading(true);
    setPaymentError(null);

    try {
      // Используем валюту из альбома
      const currency = albumCurrency || 'RUB';

      // Формируем описание товара
      const description = `${album.album} - ${album.artist} (download)`;

      // Сохраняем исходную страницу для возврата после оплаты
      // Используем только pathname, чтобы избежать проблем с query параметрами при редиректе
      const currentPath = typeof window !== 'undefined' ? window.location.pathname : '/';
      const returnTo = currentPath;

      // Формируем return URL с сохранением исходной страницы
      const returnUrl =
        typeof window !== 'undefined'
          ? `${window.location.origin}/pay/success?returnTo=${encodeURIComponent(returnTo)}`
          : '';

      // Создаем платеж через ЮKassa API
      if (!album.albumId) {
        setPaymentError('Album ID is missing. Please try again.');
        setIsPaymentLoading(false);
        return;
      }

      // Создаем платеж без токена - всегда используем redirect
      const paymentResult = await createPayment({
        amount: total,
        currency,
        description,
        albumId: album.albumId,
        customerEmail: email,
        returnUrl,
        billingData: {
          firstName,
          lastName,
        },
      });

      if (!paymentResult.success) {
        setPaymentError(paymentResult.error || 'Failed to create payment. Please try again.');
        setIsPaymentLoading(false);
        return;
      }

      // Очищаем корзину после успешного создания платежа
      clearCart();

      // Обработка результата согласно документации YooKassa:
      // Если статус pending (требуется 3D Secure), перенаправляем на confirmation_url
      // Если статус succeeded, перенаправляем на страницу успеха
      if (paymentResult.confirmationUrl) {
        // Платёж требует подтверждения (3D Secure) - перенаправляем на страницу YooKassa
        if (typeof window !== 'undefined') {
          window.location.href = paymentResult.confirmationUrl;
        }
      } else if (paymentResult.orderId) {
        // Платёж уже обработан (succeeded) - перенаправляем на страницу успеха
        if (typeof window !== 'undefined') {
          window.location.href = `${window.location.origin}/pay/success?orderId=${paymentResult.orderId}`;
        }
      } else {
        setPaymentError('Failed to get payment confirmation. Please try again.');
        setIsPaymentLoading(false);
      }
    } catch (error) {
      console.error('Error processing payment:', error);
      setPaymentError(
        error instanceof Error ? error.message : 'An unexpected error occurred. Please try again.'
      );
      setIsPaymentLoading(false);
    }
  };

  return (
    <div className="purchase-popup__checkout">
      <h2 className="purchase-popup__title">
        {album.artist} - {t?.checkout?.checkout?.title || 'Checkout'}
      </h2>

      <div className="purchase-popup__checkout-content">
        <div className="purchase-popup__checkout-form">
          <h3 className="purchase-popup__checkout-form-title">
            {t?.checkout?.checkout?.customerInformation || 'Customer Information'}
          </h3>

          <div className="purchase-popup__form-field">
            <label htmlFor="email" className="purchase-popup__form-label">
              {t?.checkout?.checkout?.emailAddress || 'Email address'}
            </label>
            <input
              type="email"
              id="email"
              className={`purchase-popup__form-input ${errors.email ? 'purchase-popup__form-input--error' : ''}`}
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                if (errors.email) {
                  setErrors({ ...errors, email: '' });
                }
              }}
              required
            />
            {errors.email && <span className="purchase-popup__form-error">{errors.email}</span>}
          </div>

          {/* Временно скрыто: Подписаться на рассылку */}
          {/* {(
            <div className="purchase-popup__form-field purchase-popup__form-field--toggle">
              <label className="purchase-popup__toggle-label">
                <input
                  type="checkbox"
                  className="purchase-popup__toggle-input"
                  checked={joinMailingList}
                  onChange={(e) => setJoinMailingList(e.target.checked)}
                />
                <span className="purchase-popup__toggle-text">
                  {t?.checkout?.checkout?.joinMailingList || 'Join the mailing list'}
                  <span className="purchase-popup__toggle-subtitle">
                    {t?.checkout?.checkout?.joinMailingListSubtitle ||
                      'You can unsubscribe at any time'}
                  </span>
                </span>
              </label>
            </div>
          )} */}

          <div className="purchase-popup__form-field">
            <label htmlFor="firstName" className="purchase-popup__form-label">
              {t?.checkout?.checkout?.firstName || 'First name'}
            </label>
            <input
              type="text"
              id="firstName"
              className={`purchase-popup__form-input ${errors.firstName ? 'purchase-popup__form-input--error' : ''}`}
              value={firstName}
              onChange={(e) => {
                setFirstName(e.target.value);
                if (errors.firstName) {
                  setErrors({ ...errors, firstName: '' });
                }
              }}
              required
            />
            {errors.firstName && (
              <span className="purchase-popup__form-error">{errors.firstName}</span>
            )}
          </div>

          <div className="purchase-popup__form-field">
            <label htmlFor="lastName" className="purchase-popup__form-label">
              {t?.checkout?.checkout?.lastName || 'Last name'}
            </label>
            <input
              type="text"
              id="lastName"
              className={`purchase-popup__form-input ${errors.lastName ? 'purchase-popup__form-input--error' : ''}`}
              value={lastName}
              onChange={(e) => {
                setLastName(e.target.value);
                if (errors.lastName) {
                  setErrors({ ...errors, lastName: '' });
                }
              }}
              required
            />
            {errors.lastName && (
              <span className="purchase-popup__form-error">{errors.lastName}</span>
            )}
          </div>

          {/* Временно скрыто: Примечания */}
          {/* {(
            <div className="purchase-popup__form-field">
              <label htmlFor="notes" className="purchase-popup__form-label">
                {t?.checkout?.checkout?.notes || 'Notes'}
              </label>
              <textarea
                id="notes"
                className="purchase-popup__form-textarea"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
              />
            </div>
          )} */}

          <div className="purchase-popup__form-field purchase-popup__form-field--toggle">
            <label className="purchase-popup__toggle-label">
              <input
                type="checkbox"
                className="purchase-popup__toggle-input"
                checked={agreeToOffer}
                onChange={(e) => {
                  setAgreeToOffer(e.target.checked);
                  if (errors.agreeToOffer) {
                    setErrors({ ...errors, agreeToOffer: '' });
                  }
                }}
                required
              />
              <span className="purchase-popup__toggle-text">
                {t?.checkout?.checkout?.agreeToOffer || 'Согласен с'}{' '}
                <Link to="/offer" target="_blank" className="purchase-popup__link">
                  {t?.checkout?.checkout?.publicOffer || 'Публичной офертой'}
                </Link>
                {errors.agreeToOffer && (
                  <span className="purchase-popup__form-error">{errors.agreeToOffer}</span>
                )}
              </span>
            </label>
          </div>

          <div className="purchase-popup__form-field purchase-popup__form-field--toggle">
            <label className="purchase-popup__toggle-label">
              <input
                type="checkbox"
                className="purchase-popup__toggle-input"
                checked={agreeToPrivacy}
                onChange={(e) => {
                  setAgreeToPrivacy(e.target.checked);
                  if (errors.agreeToPrivacy) {
                    setErrors({ ...errors, agreeToPrivacy: '' });
                  }
                }}
                required
              />
              <span className="purchase-popup__toggle-text">
                {t?.checkout?.checkout?.agreeToPrivacy || 'Даю согласие на'}{' '}
                <Link to="/privacy" target="_blank" className="purchase-popup__link">
                  {t?.checkout?.checkout?.privacyPolicy || 'обработку персональных данных'}
                </Link>
                {errors.agreeToPrivacy && (
                  <span className="purchase-popup__form-error">{errors.agreeToPrivacy}</span>
                )}
              </span>
            </label>
          </div>

          {paymentError && (
            <div className="purchase-popup__payment-error" role="alert">
              <span className="purchase-popup__form-error">{paymentError}</span>
            </div>
          )}

          <div className="purchase-popup__checkout-actions">
            <button
              type="button"
              className="purchase-popup__link-button"
              onClick={onBackToCart}
              aria-label={t?.checkout?.checkout?.backToCart || 'Back to cart'}
            >
              {t?.checkout?.checkout?.backToCart || '< Back to cart'}
            </button>
            <button
              type="button"
              className="purchase-popup__button purchase-popup__button--payment"
              onClick={handlePayment}
              disabled={isPaymentLoading}
              aria-label={t?.checkout?.payment?.proceedToPayment || 'Перейти к оплате в ЮKassa'}
            >
              {isPaymentLoading ? (
                <>
                  <span className="purchase-popup__button-spinner" aria-hidden="true" />
                  <span>{t?.checkout?.payment?.processing || 'Обработка...'}</span>
                </>
              ) : (
                t?.checkout?.checkout?.continueToPayment ||
                t?.checkout?.payment?.proceedToPayment ||
                'Перейти к способу оплаты'
              )}
            </button>
          </div>

          <p
            className="purchase-popup__payment-info"
            style={{ marginTop: '16px', fontSize: '14px', opacity: 0.8 }}
          >
            {t?.checkout?.payment?.securePaymentInfo ||
              'Оплата проходит на защищённой странице ЮKassa. Данные карты вводятся там.'}
          </p>
        </div>

        <div className="purchase-popup__checkout-summary">
          <h3 className="purchase-popup__checkout-summary-title">
            {t?.checkout?.checkout?.orderSummary || 'Order Summary'}
          </h3>

          <table className="purchase-popup__order-table">
            <thead>
              <tr>
                <th>{t?.checkout?.checkout?.desc || 'DESC'}</th>
                <th>{t?.checkout?.checkout?.qty || 'QTY'}</th>
                <th>{t?.checkout?.checkout?.price || 'PRICE'}</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>
                  <div className="purchase-popup__order-item">
                    <div className="purchase-popup__order-item-thumbnail">
                      {album?.cover ? (
                        <AlbumCover
                          img={album.cover}
                          fullName={album.fullName}
                          size={64}
                          densities={[1, 2]}
                          sizes="64px"
                        />
                      ) : (
                        <div
                          className="purchase-popup__item-thumbnail-placeholder"
                          aria-hidden="true"
                        />
                      )}
                    </div>
                    <div className="purchase-popup__order-item-info">
                      <div className="purchase-popup__order-item-title">{album.album}</div>
                      <div className="purchase-popup__order-item-type">
                        {t?.checkout?.checkout?.singleDownload || 'Single download'}
                      </div>
                    </div>
                  </div>
                </td>
                <td>1</td>
                <td>{getAlbumPrice(album).formatted}</td>
              </tr>
            </tbody>
          </table>

          <div className="purchase-popup__discount">
            <div className="purchase-popup__discount-input-wrapper">
              <input
                type="text"
                className="purchase-popup__discount-input"
                placeholder={t?.checkout?.checkout?.discountCode || 'Discount code or gift card'}
                value={discountCode}
                onChange={(e) => setDiscountCode(e.target.value)}
              />
              <button type="button" className="purchase-popup__discount-button">
                {t?.checkout?.checkout?.apply || 'Apply'}
              </button>
            </div>
          </div>

          <div className="purchase-popup__checkout-totals">
            <div className="purchase-popup__checkout-total">
              {t?.checkout?.checkout?.total || 'Total'}{' '}
              <span>{getAlbumPrice(album).formatted}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function PurchasePopup({
  isOpen,
  albums,
  onClose,
  onRemove,
  onContinueShopping,
  onRegister,
}: PurchasePopupProps) {
  const { lang } = useLang();
  const ui = useAppSelector((state) => selectUiDictionaryFirst(state, lang));
  const t = ui || null;

  const [step, setStep] = useState<Step>('cart');

  // Автозаполнение данных из профиля, если пользователь авторизован
  const getInitialFormData = (): CheckoutFormData => {
    const user = getUser();
    if (user?.email) {
      // Разделяем имя на имя и фамилию, если есть
      const nameParts = user.name?.split(' ') || [];
      const firstName = nameParts[0] || '';
      const lastName = nameParts.slice(1).join(' ') || '';

      return {
        email: user.email,
        firstName,
        lastName,
        notes: '',
        joinMailingList: false,
        agreeToOffer: false,
        agreeToPrivacy: false,
      };
    }

    return {
      email: '',
      firstName: '',
      lastName: '',
      notes: '',
      joinMailingList: false,
      agreeToOffer: false,
      agreeToPrivacy: false,
    };
  };

  const [checkoutFormData, setCheckoutFormData] = useState<CheckoutFormData>(getInitialFormData);

  const handleCheckout = () => {
    setStep('checkout');
  };

  const handleBackToCart = () => {
    setStep('cart');
  };

  // Сбрасываем шаг и обновляем данные формы при открытии/закрытии попапа
  React.useEffect(() => {
    if (!isOpen) {
      setStep('cart');
      // При закрытии сбрасываем форму
      setCheckoutFormData({
        email: '',
        firstName: '',
        lastName: '',
        notes: '',
        joinMailingList: false,
        agreeToOffer: false,
        agreeToPrivacy: false,
      });
    } else {
      // При открытии обновляем данные из профиля, если пользователь авторизован
      setCheckoutFormData(getInitialFormData());
    }
  }, [isOpen]);

  // Используем первый альбом для CheckoutStep (можно улучшить для поддержки нескольких альбомов)
  const firstAlbum = albums[0];

  // Если корзина пуста, не показываем попап
  if (albums.length === 0) {
    return null;
  }

  return (
    <Popup isActive={isOpen} onClose={onClose} bgColor="rgba(var(--deep-black-rgb) / 95%)">
      <div className="purchase-popup">
        <div className="purchase-popup__container">
          <button
            type="button"
            className="purchase-popup__close"
            onClick={onClose}
            aria-label="Закрыть"
          >
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
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
            <span className="visually-hidden">Закрыть</span>
          </button>
          {step === 'cart' ? (
            <CartStep
              albums={albums}
              onRemove={onRemove}
              onContinueShopping={onContinueShopping}
              onCheckout={handleCheckout}
              t={t}
            />
          ) : (
            <CheckoutStep
              album={firstAlbum}
              onBackToCart={handleBackToCart}
              formData={checkoutFormData}
              onFormDataChange={setCheckoutFormData}
              t={t}
            />
          )}
        </div>
      </div>
    </Popup>
  );
}

export default PurchasePopup;
