import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Popup } from '@shared/ui/popup';
import { Hamburger } from '@shared/ui/hamburger';
import type { IAlbums } from '@models';
import AlbumCover from '@entities/album/ui/AlbumCover';
import { createPayment } from '@shared/api/payment';
import './PurchasePopup.style.scss';

type Step = 'cart' | 'checkout' | 'payment';

// Утилиты для форматирования
const formatCardNumber = (value: string): string => {
  const cleaned = value.replace(/\s/g, '').replace(/\D/g, '');
  const groups = cleaned.match(/.{1,4}/g) || [];
  return groups.join(' ').slice(0, 19); // Максимум 16 цифр + 3 пробела
};

const formatCardExpiry = (value: string): string => {
  const cleaned = value.replace(/\D/g, '');
  if (cleaned.length >= 2) {
    return `${cleaned.slice(0, 2)}/${cleaned.slice(2, 4)}`;
  }
  return cleaned;
};

const formatCSC = (value: string): string => {
  return value.replace(/\D/g, '').slice(0, 4);
};

// Валидация
interface ValidationErrors {
  [key: string]: string;
}

const validateEmail = (email: string): string => {
  if (!email) return 'Email is required';
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) return 'Please enter a valid email address';
  return '';
};

const validateCardNumber = (cardNumber: string): string => {
  const cleaned = cardNumber.replace(/\s/g, '');
  if (!cleaned) return 'Card number is required';
  if (cleaned.length < 13 || cleaned.length > 19) return 'Card number must be 13-19 digits';
  return '';
};

const validateCardExpiry = (expiry: string): string => {
  if (!expiry) return 'Expiry date is required';
  const [month, year] = expiry.split('/');
  if (!month || !year || month.length !== 2 || year.length !== 2) {
    return 'Please enter a valid expiry date (MM/YY)';
  }
  const monthNum = parseInt(month, 10);
  if (monthNum < 1 || monthNum > 12) return 'Month must be between 01 and 12';
  return '';
};

const validateCSC = (csc: string): string => {
  if (!csc) return 'CSC is required';
  if (csc.length < 3 || csc.length > 4) return 'CSC must be 3-4 digits';
  return '';
};

const validateRequired = (value: string, fieldName: string): string => {
  if (!value.trim()) return `${fieldName} is required`;
  return '';
};

interface PurchasePopupProps {
  isOpen: boolean;
  album: IAlbums;
  onClose: () => void;
  onRemove: () => void;
  onContinueShopping: () => void;
  onRegister: () => void;
}

function ProgressIndicator({ currentStep }: { currentStep: Step }) {
  const steps: { key: Step; label: string }[] = [
    { key: 'cart', label: 'Cart' },
    { key: 'checkout', label: 'Checkout' },
    { key: 'payment', label: 'Payment' },
  ];

  const currentStepIndex = steps.findIndex((s) => s.key === currentStep);

  return (
    <div className="purchase-popup__progress">
      {steps.map((step, index) => (
        <React.Fragment key={step.key}>
          <div className="purchase-popup__progress-step">
            <div
              className={`purchase-popup__progress-step-circle ${
                index <= currentStepIndex ? 'purchase-popup__progress-step-circle--active' : ''
              }`}
            >
              {index + 1}
            </div>
            <span
              className={`purchase-popup__progress-step-label ${
                index <= currentStepIndex ? 'purchase-popup__progress-step-label--active' : ''
              }`}
            >
              {step.label}
            </span>
          </div>
          {index < steps.length - 1 && (
            <div
              className={`purchase-popup__progress-line ${
                index < currentStepIndex ? 'purchase-popup__progress-line--active' : ''
              }`}
            />
          )}
        </React.Fragment>
      ))}
    </div>
  );
}

function CartStep({
  album,
  onRemove,
  onContinueShopping,
  onCheckout,
}: {
  album: IAlbums;
  onRemove: () => void;
  onContinueShopping: () => void;
  onCheckout: () => void;
}) {
  return (
    <>
      <ProgressIndicator currentStep="cart" />
      <h2 className="purchase-popup__title">Your cart</h2>

      <div className="purchase-popup__divider" />

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
          <div className="purchase-popup__item-type">Album download</div>
          <div className="purchase-popup__item-actions">
            <span className="purchase-popup__item-quantity">1</span>
            <button
              type="button"
              className="purchase-popup__item-remove"
              onClick={onRemove}
              aria-label="Remove item"
            >
              Remove
            </button>
          </div>
        </div>

        <div className="purchase-popup__item-price">C$0.99</div>
      </div>

      <div className="purchase-popup__divider" />

      <div className="purchase-popup__summary">
        <div className="purchase-popup__subtotal">
          Subtotal <span>C$0.99</span>
        </div>

        <button
          type="button"
          className="purchase-popup__button purchase-popup__button--checkout"
          onClick={onCheckout}
          aria-label="Checkout"
        >
          CHECKOUT
        </button>

        <button
          type="button"
          className="purchase-popup__button purchase-popup__button--continue"
          onClick={onContinueShopping}
          aria-label="Continue shopping"
        >
          Continue shopping
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
  onContinueToPayment,
  formData,
  onFormDataChange,
}: {
  album: IAlbums;
  onBackToCart: () => void;
  onContinueToPayment: () => void;
  formData: CheckoutFormData;
  onFormDataChange: (data: CheckoutFormData) => void;
}) {
  const [email, setEmail] = useState(formData.email);
  const [firstName, setFirstName] = useState(formData.firstName);
  const [lastName, setLastName] = useState(formData.lastName);
  const [notes, setNotes] = useState(formData.notes);
  const [joinMailingList, setJoinMailingList] = useState(formData.joinMailingList);
  const [agreeToOffer, setAgreeToOffer] = useState(formData.agreeToOffer);
  const [agreeToPrivacy, setAgreeToPrivacy] = useState(formData.agreeToPrivacy);
  const [discountCode, setDiscountCode] = useState('');
  const [errors, setErrors] = useState<ValidationErrors>({});

  const validateForm = (): boolean => {
    const newErrors: ValidationErrors = {};

    const emailError = validateEmail(email);
    if (emailError) newErrors.email = emailError;

    const firstNameError = validateRequired(firstName, 'First name');
    if (firstNameError) newErrors.firstName = firstNameError;

    const lastNameError = validateRequired(lastName, 'Last name');
    if (lastNameError) newErrors.lastName = lastNameError;

    if (!agreeToOffer) {
      newErrors.agreeToOffer = 'You must agree to the offer';
    }

    if (!agreeToPrivacy) {
      newErrors.agreeToPrivacy = 'You must agree to the privacy policy';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleContinue = () => {
    if (validateForm()) {
      onFormDataChange({
        email,
        firstName,
        lastName,
        notes,
        joinMailingList,
        agreeToOffer,
        agreeToPrivacy,
      });
      onContinueToPayment();
    }
  };

  return (
    <div className="purchase-popup__checkout">
      <ProgressIndicator currentStep="checkout" />
      <h2 className="purchase-popup__title">{album.artist} - Checkout</h2>

      <div className="purchase-popup__checkout-content">
        <div className="purchase-popup__checkout-form">
          <h3 className="purchase-popup__checkout-form-title">Customer Information</h3>

          <div className="purchase-popup__form-field">
            <label htmlFor="email" className="purchase-popup__form-label">
              Email address
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

          <div className="purchase-popup__form-field purchase-popup__form-field--toggle">
            <label className="purchase-popup__toggle-label">
              <input
                type="checkbox"
                className="purchase-popup__toggle-input"
                checked={joinMailingList}
                onChange={(e) => setJoinMailingList(e.target.checked)}
              />
              <span className="purchase-popup__toggle-text">
                Join the mailing list
                <span className="purchase-popup__toggle-subtitle">
                  You can unsubscribe at any time
                </span>
              </span>
            </label>
          </div>

          <div className="purchase-popup__form-field">
            <label htmlFor="firstName" className="purchase-popup__form-label">
              First name
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
              Last name
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

          <div className="purchase-popup__form-field">
            <label htmlFor="notes" className="purchase-popup__form-label">
              Notes
            </label>
            <textarea
              id="notes"
              className="purchase-popup__form-textarea"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
            />
          </div>

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
                Согласен с{' '}
                <Link to="/offer" target="_blank" className="purchase-popup__link">
                  Публичной офертой
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
                Даю согласие на{' '}
                <Link to="/privacy" target="_blank" className="purchase-popup__link">
                  обработку персональных данных
                </Link>
                {errors.agreeToPrivacy && (
                  <span className="purchase-popup__form-error">{errors.agreeToPrivacy}</span>
                )}
              </span>
            </label>
          </div>

          <div className="purchase-popup__checkout-actions">
            <button
              type="button"
              className="purchase-popup__link-button"
              onClick={onBackToCart}
              aria-label="Back to cart"
            >
              &lt; Back to cart
            </button>
            <button
              type="button"
              className="purchase-popup__button purchase-popup__button--payment"
              onClick={handleContinue}
              aria-label="Continue to payment method"
            >
              Continue to payment method
            </button>
          </div>
        </div>

        <div className="purchase-popup__checkout-summary">
          <h3 className="purchase-popup__checkout-summary-title">Order Summary</h3>

          <table className="purchase-popup__order-table">
            <thead>
              <tr>
                <th>DESC</th>
                <th>QTY</th>
                <th>PRICE</th>
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
                      <div className="purchase-popup__order-item-type">Single download</div>
                    </div>
                  </div>
                </td>
                <td>1</td>
                <td>C$0.99</td>
              </tr>
            </tbody>
          </table>

          <div className="purchase-popup__discount">
            <div className="purchase-popup__discount-input-wrapper">
              <input
                type="text"
                className="purchase-popup__discount-input"
                placeholder="Discount code or gift card"
                value={discountCode}
                onChange={(e) => setDiscountCode(e.target.value)}
              />
              <button type="button" className="purchase-popup__discount-button">
                Apply
              </button>
            </div>
          </div>

          <div className="purchase-popup__checkout-totals">
            <div className="purchase-popup__checkout-subtotal">
              Subtotal <span>C$0.99</span>
            </div>
            <div className="purchase-popup__checkout-total">
              Total <span>C$0.99</span>
            </div>
          </div>

          <div className="purchase-popup__checkout-back-link">
            <button
              type="button"
              className="purchase-popup__link-button"
              onClick={onBackToCart}
              aria-label="Back to site"
            >
              &lt; Back to {window.location.hostname.replace('www.', '')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function PaymentStep({
  album,
  onBackToCart,
  onBackToCheckout,
  formData,
  onEditCustomerInfo,
  discountCode: initialDiscountCode,
}: {
  album: IAlbums;
  onBackToCart: () => void;
  onBackToCheckout: () => void;
  formData: CheckoutFormData;
  onEditCustomerInfo: () => void;
  discountCode: string;
}) {
  const [discountCode, setDiscountCode] = useState(initialDiscountCode);
  const [isCardFormOpen, setIsCardFormOpen] = useState(false);
  const [cardEmail, setCardEmail] = useState(formData.email);
  const [cardNumber, setCardNumber] = useState('');
  const [cardExpires, setCardExpires] = useState('');
  const [cardCSC, setCardCSC] = useState('');
  const [billingFirstName, setBillingFirstName] = useState(formData.firstName);
  const [billingLastName, setBillingLastName] = useState(formData.lastName);
  const [zipCode, setZipCode] = useState('');
  const [country, setCountry] = useState('US');
  const [mobile, setMobile] = useState('+1');
  const [confirmAge, setConfirmAge] = useState(false);
  const [cardErrors, setCardErrors] = useState<ValidationErrors>({});
  const [isPaymentLoading, setIsPaymentLoading] = useState(false);
  const [paymentError, setPaymentError] = useState<string | null>(null);
  const subtotal = 0.99;
  const total = subtotal;

  const handlePayPal = () => {
    // Создаем PayPal checkout URL с параметрами заказа
    const amount = total.toFixed(2);
    const itemName = album.album || 'Album download';
    const returnUrl =
      typeof window !== 'undefined'
        ? `${window.location.origin}${window.location.pathname}?paypal=success`
        : '';
    const cancelUrl =
      typeof window !== 'undefined'
        ? `${window.location.origin}${window.location.pathname}?paypal=cancel`
        : '';

    // PayPal Express Checkout URL (для sandbox или production)
    // В продакшене это должно быть настроено через PayPal API
    const paypalUrl = new URL('https://www.paypal.com/checkoutnow');
    paypalUrl.searchParams.set('amount', amount);
    paypalUrl.searchParams.set('currency', 'CAD');
    paypalUrl.searchParams.set('item_name', itemName);
    paypalUrl.searchParams.set('email', formData.email || '');
    if (returnUrl) {
      paypalUrl.searchParams.set('return', returnUrl);
    }
    if (cancelUrl) {
      paypalUrl.searchParams.set('cancel_return', cancelUrl);
    }

    // Открываем PayPal в новом окне
    const paypalWindow = window.open(
      paypalUrl.toString(),
      'paypal-checkout',
      'width=600,height=700,scrollbars=yes,resizable=yes'
    );

    // Обработка закрытия окна PayPal (опционально)
    if (paypalWindow) {
      const checkClosed = setInterval(() => {
        if (paypalWindow.closed) {
          clearInterval(checkClosed);
          // Можно добавить обработку результата платежа
          console.log('PayPal window closed');
        }
      }, 500);
    }
  };

  const handleCard = (countryCode?: string) => {
    // Предзаполняем данные из формы checkout
    setCardEmail(formData.email);
    setBillingFirstName(formData.firstName);
    setBillingLastName(formData.lastName);
    // Устанавливаем страну, если указана (для кнопки "Bank Card (Russia, CIS)")
    if (countryCode) {
      setCountry(countryCode);
    }
    setIsCardFormOpen(true);

    // Плавная прокрутка к форме через небольшую задержку для завершения анимации
    setTimeout(() => {
      const cardForm = document.querySelector('.purchase-popup__card-form') as HTMLElement;
      if (cardForm) {
        cardForm.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
    }, 100);
  };

  const handleCloseCardForm = () => {
    setIsCardFormOpen(false);
  };

  const validateCardForm = (): boolean => {
    const newErrors: ValidationErrors = {};

    const emailError = validateEmail(cardEmail);
    if (emailError) newErrors.cardEmail = emailError;

    const cardNumberError = validateCardNumber(cardNumber);
    if (cardNumberError) newErrors.cardNumber = cardNumberError;

    const expiryError = validateCardExpiry(cardExpires);
    if (expiryError) newErrors.cardExpires = expiryError;

    const cscError = validateCSC(cardCSC);
    if (cscError) newErrors.cardCSC = cscError;

    const firstNameError = validateRequired(billingFirstName, 'First name');
    if (firstNameError) newErrors.billingFirstName = firstNameError;

    const lastNameError = validateRequired(billingLastName, 'Last name');
    if (lastNameError) newErrors.billingLastName = lastNameError;

    const zipError = validateRequired(zipCode, 'ZIP code');
    if (zipError) newErrors.zipCode = zipError;

    const mobileError = validateRequired(mobile, 'Mobile');
    if (mobileError) newErrors.mobile = mobileError;

    if (!confirmAge) newErrors.confirmAge = 'You must confirm you are 18 years or older';

    // Проверяем согласие с офертой и политикой конфиденциальности
    if (!formData.agreeToOffer) {
      newErrors.agreeToOffer = 'You must agree to the offer';
    }

    if (!formData.agreeToPrivacy) {
      newErrors.agreeToPrivacy = 'You must agree to the privacy policy';
    }

    setCardErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleCardPayment = async () => {
    if (!validateCardForm()) {
      return;
    }

    setIsPaymentLoading(true);
    setPaymentError(null);

    try {
      // Определяем валюту в зависимости от страны
      let currency = 'RUB'; // По умолчанию для России/СНГ
      if (country === 'US') currency = 'USD';
      else if (country === 'GB') currency = 'GBP';
      else if (country === 'DE' || country === 'FR' || country === 'IT' || country === 'ES')
        currency = 'EUR';

      // Формируем описание товара
      const description = `${album.album} - ${album.artist} (download)`;

      // Формируем return URL
      const returnUrl =
        typeof window !== 'undefined'
          ? `${window.location.origin}${window.location.pathname}?payment=success&albumId=${album.albumId}`
          : '';

      // Создаем платеж через ЮKassa API
      if (!album.albumId) {
        setPaymentError('Album ID is missing. Please try again.');
        setIsPaymentLoading(false);
        return;
      }

      const paymentResult = await createPayment({
        amount: total,
        currency,
        description,
        albumId: album.albumId,
        customerEmail: cardEmail,
        returnUrl,
        billingData: {
          firstName: billingFirstName,
          lastName: billingLastName,
          phone: mobile || undefined,
          country,
          zip: zipCode || undefined,
        },
      });

      if (!paymentResult.success || !paymentResult.confirmationUrl) {
        setPaymentError(paymentResult.error || 'Failed to create payment. Please try again.');
        setIsPaymentLoading(false);
        return;
      }

      // Перенаправляем на страницу оплаты ЮKassa
      if (typeof window !== 'undefined' && paymentResult.confirmationUrl) {
        window.location.href = paymentResult.confirmationUrl;
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
    <div className="purchase-popup__payment">
      <ProgressIndicator currentStep="payment" />
      <h2 className="purchase-popup__title">{album.artist} - Checkout</h2>

      <div className="purchase-popup__payment-content">
        <div className="purchase-popup__payment-form">
          <h3 className="purchase-popup__payment-title">Payment</h3>

          <div className="purchase-popup__customer-info-card">
            <div className="purchase-popup__customer-info-header">
              <h4 className="purchase-popup__customer-info-title">Customer Information</h4>
              <button
                type="button"
                className="purchase-popup__link-button"
                onClick={onEditCustomerInfo}
                aria-label="Edit customer information"
              >
                Edit
              </button>
            </div>
            <div className="purchase-popup__customer-info-details">
              <div className="purchase-popup__customer-info-item">
                <span className="purchase-popup__customer-info-label">Email:</span>{' '}
                <span className="purchase-popup__customer-info-value">{formData.email || '—'}</span>
              </div>
              <div className="purchase-popup__customer-info-item">
                <span className="purchase-popup__customer-info-label">Name:</span>{' '}
                <span className="purchase-popup__customer-info-value">
                  {formData.firstName && formData.lastName
                    ? `${formData.firstName} ${formData.lastName}`
                    : '—'}
                </span>
              </div>
            </div>
          </div>

          <div className="purchase-popup__payment-methods">
            <button
              type="button"
              className="purchase-popup__payment-button purchase-popup__payment-button--paypal"
              onClick={handlePayPal}
              aria-label="Pay with PayPal"
            >
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                aria-hidden="true"
                style={{ marginRight: '8px' }}
              >
                <path
                  d="M7.076 21.337H2.47a.641.641 0 0 1-.633-.74L4.944.901C5.026.382 5.474 0 5.998 0h7.46c2.57 0 4.578.543 5.69 1.81 1.01 1.15 1.304 2.42 1.012 4.287-.023.143-.047.288-.077.437-.983 5.05-4.349 6.797-8.647 6.797h-2.19c-.524 0-.968.382-1.05.9l-1.12 7.106zm14.146-14.42a.915.915 0 0 0-.028-.225c-.207-1.226-1.126-2.182-2.698-2.733l-.556-.169a.817.817 0 0 1-.554-.768V3.19a.816.816 0 0 0-.811-.82H5.998a.642.642 0 0 0-.634.74l2.107 13.396h3.277l1.12-7.106c.082-.518.526-.9 1.05-.9h2.19c4.298 0 7.664-1.747 8.647-6.797.03-.149.054-.294.077-.437z"
                  fill="currentColor"
                />
              </svg>
              PayPal
            </button>

            <button
              type="button"
              className="purchase-popup__payment-button purchase-popup__payment-button--card"
              onClick={() => handleCard()}
              aria-label="Pay with debit or credit card"
              aria-expanded={isCardFormOpen}
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
                style={{ marginRight: '8px' }}
              >
                <rect x="1" y="4" width="22" height="16" rx="2" ry="2" />
                <line x1="1" y1="10" x2="23" y2="10" />
              </svg>
              Debit or Credit Card
            </button>

            <button
              type="button"
              className="purchase-popup__payment-button purchase-popup__payment-button--card"
              onClick={() => handleCard('RU')}
              aria-label="Bank Card (Russia, CIS)"
              aria-expanded={isCardFormOpen}
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
                style={{ marginRight: '8px' }}
              >
                <rect x="1" y="4" width="22" height="16" rx="2" ry="2" />
                <line x1="1" y1="10" x2="23" y2="10" />
              </svg>
              Bank Card (Russia, CIS)
            </button>

            {isCardFormOpen && (
              <div className="purchase-popup__card-form">
                <button
                  type="button"
                  className="purchase-popup__card-form-close"
                  onClick={handleCloseCardForm}
                  aria-label="Close card form"
                >
                  <svg
                    width="20"
                    height="20"
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
                </button>

                <div className="purchase-popup__card-form-content">
                  <div className="purchase-popup__form-field">
                    <label htmlFor="card-email" className="purchase-popup__form-label">
                      Email
                    </label>
                    <input
                      type="email"
                      id="card-email"
                      className={`purchase-popup__form-input ${cardErrors.cardEmail ? 'purchase-popup__form-input--error' : ''}`}
                      value={cardEmail}
                      onChange={(e) => {
                        setCardEmail(e.target.value);
                        if (cardErrors.cardEmail) {
                          setCardErrors({ ...cardErrors, cardEmail: '' });
                        }
                      }}
                      required
                    />
                    {cardErrors.cardEmail && (
                      <span className="purchase-popup__form-error">{cardErrors.cardEmail}</span>
                    )}
                  </div>

                  <div className="purchase-popup__form-field">
                    <label htmlFor="card-number" className="purchase-popup__form-label">
                      Card number
                    </label>
                    <input
                      type="text"
                      id="card-number"
                      className={`purchase-popup__form-input ${cardErrors.cardNumber ? 'purchase-popup__form-input--error' : ''}`}
                      value={cardNumber}
                      onChange={(e) => {
                        const formatted = formatCardNumber(e.target.value);
                        setCardNumber(formatted);
                        if (cardErrors.cardNumber) {
                          setCardErrors({ ...cardErrors, cardNumber: '' });
                        }
                      }}
                      placeholder="1234 5678 9012 3456"
                      maxLength={19}
                      required
                    />
                    {cardErrors.cardNumber && (
                      <span className="purchase-popup__form-error">{cardErrors.cardNumber}</span>
                    )}
                  </div>

                  <div className="purchase-popup__form-field purchase-popup__form-field--row">
                    <div className="purchase-popup__form-field purchase-popup__form-field--expires">
                      <label htmlFor="card-expires" className="purchase-popup__form-label">
                        Expires
                      </label>
                      <input
                        type="text"
                        id="card-expires"
                        className={`purchase-popup__form-input ${cardErrors.cardExpires ? 'purchase-popup__form-input--error' : ''}`}
                        value={cardExpires}
                        onChange={(e) => {
                          const formatted = formatCardExpiry(e.target.value);
                          setCardExpires(formatted);
                          if (cardErrors.cardExpires) {
                            setCardErrors({ ...cardErrors, cardExpires: '' });
                          }
                        }}
                        placeholder="MM/YY"
                        maxLength={5}
                        required
                      />
                      {cardErrors.cardExpires && (
                        <span className="purchase-popup__form-error">{cardErrors.cardExpires}</span>
                      )}
                    </div>
                    <div className="purchase-popup__form-field purchase-popup__form-field--csc">
                      <label htmlFor="card-csc" className="purchase-popup__form-label">
                        CSC
                      </label>
                      <input
                        type="text"
                        id="card-csc"
                        className={`purchase-popup__form-input ${cardErrors.cardCSC ? 'purchase-popup__form-input--error' : ''}`}
                        value={cardCSC}
                        onChange={(e) => {
                          const formatted = formatCSC(e.target.value);
                          setCardCSC(formatted);
                          if (cardErrors.cardCSC) {
                            setCardErrors({ ...cardErrors, cardCSC: '' });
                          }
                        }}
                        placeholder="123"
                        maxLength={4}
                        required
                      />
                      {cardErrors.cardCSC && (
                        <span className="purchase-popup__form-error">{cardErrors.cardCSC}</span>
                      )}
                    </div>
                  </div>

                  <div className="purchase-popup__billing-address">
                    <h4 className="purchase-popup__billing-address-title">Billing address</h4>

                    <div className="purchase-popup__form-field purchase-popup__form-field--row">
                      <div className="purchase-popup__form-field purchase-popup__form-field--first-name">
                        <label htmlFor="billing-first-name" className="purchase-popup__form-label">
                          First name
                        </label>
                        <input
                          type="text"
                          id="billing-first-name"
                          className={`purchase-popup__form-input ${cardErrors.billingFirstName ? 'purchase-popup__form-input--error' : ''}`}
                          value={billingFirstName}
                          onChange={(e) => {
                            setBillingFirstName(e.target.value);
                            if (cardErrors.billingFirstName) {
                              setCardErrors({ ...cardErrors, billingFirstName: '' });
                            }
                          }}
                          required
                        />
                        {cardErrors.billingFirstName && (
                          <span className="purchase-popup__form-error">
                            {cardErrors.billingFirstName}
                          </span>
                        )}
                      </div>
                      <div className="purchase-popup__form-field purchase-popup__form-field--last-name">
                        <label htmlFor="billing-last-name" className="purchase-popup__form-label">
                          Last name
                        </label>
                        <input
                          type="text"
                          id="billing-last-name"
                          className={`purchase-popup__form-input ${cardErrors.billingLastName ? 'purchase-popup__form-input--error' : ''}`}
                          value={billingLastName}
                          onChange={(e) => {
                            setBillingLastName(e.target.value);
                            if (cardErrors.billingLastName) {
                              setCardErrors({ ...cardErrors, billingLastName: '' });
                            }
                          }}
                          required
                        />
                        {cardErrors.billingLastName && (
                          <span className="purchase-popup__form-error">
                            {cardErrors.billingLastName}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="purchase-popup__form-field">
                      <label htmlFor="zip-code" className="purchase-popup__form-label">
                        ZIP code
                      </label>
                      <input
                        type="text"
                        id="zip-code"
                        className={`purchase-popup__form-input ${cardErrors.zipCode ? 'purchase-popup__form-input--error' : ''}`}
                        value={zipCode}
                        onChange={(e) => {
                          setZipCode(e.target.value);
                          if (cardErrors.zipCode) {
                            setCardErrors({ ...cardErrors, zipCode: '' });
                          }
                        }}
                        required
                      />
                      {cardErrors.zipCode && (
                        <span className="purchase-popup__form-error">{cardErrors.zipCode}</span>
                      )}
                    </div>

                    <div className="purchase-popup__form-field">
                      <label htmlFor="country" className="purchase-popup__form-label">
                        Country
                      </label>
                      <div className="purchase-popup__country-select-wrapper">
                        <select
                          id="country"
                          className="purchase-popup__country-select"
                          value={country}
                          onChange={(e) => setCountry(e.target.value)}
                          required
                        >
                          <option value="US">United States</option>
                          <option value="CA">Canada</option>
                          <option value="GB">United Kingdom</option>
                          <option value="DE">Germany</option>
                          <option value="FR">France</option>
                          <option value="IT">Italy</option>
                          <option value="ES">Spain</option>
                          <option value="RU">Russia</option>
                        </select>
                        <svg
                          width="16"
                          height="16"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          className="purchase-popup__country-select-arrow"
                          aria-hidden="true"
                        >
                          <polyline points="6 9 12 15 18 9" />
                        </svg>
                      </div>
                    </div>

                    <div className="purchase-popup__form-field">
                      <label htmlFor="mobile" className="purchase-popup__form-label">
                        Mobile
                      </label>
                      <input
                        type="tel"
                        id="mobile"
                        className={`purchase-popup__form-input ${cardErrors.mobile ? 'purchase-popup__form-input--error' : ''}`}
                        value={mobile}
                        onChange={(e) => {
                          setMobile(e.target.value);
                          if (cardErrors.mobile) {
                            setCardErrors({ ...cardErrors, mobile: '' });
                          }
                        }}
                        required
                      />
                      {cardErrors.mobile && (
                        <span className="purchase-popup__form-error">{cardErrors.mobile}</span>
                      )}
                    </div>
                  </div>

                  <div className="purchase-popup__form-field purchase-popup__form-field--toggle">
                    <label className="purchase-popup__toggle-label">
                      <input
                        type="checkbox"
                        className={`purchase-popup__toggle-input ${cardErrors.confirmAge ? 'purchase-popup__toggle-input--error' : ''}`}
                        checked={confirmAge}
                        onChange={(e) => {
                          setConfirmAge(e.target.checked);
                          if (cardErrors.confirmAge) {
                            setCardErrors({ ...cardErrors, confirmAge: '' });
                          }
                        }}
                        required
                      />
                      <span className="purchase-popup__toggle-text">
                        By continuing, you confirm you're 18 years or older.
                      </span>
                    </label>
                    {cardErrors.confirmAge && (
                      <span className="purchase-popup__form-error">{cardErrors.confirmAge}</span>
                    )}
                  </div>

                  {paymentError && (
                    <div className="purchase-popup__payment-error" role="alert">
                      <span className="purchase-popup__form-error">{paymentError}</span>
                    </div>
                  )}

                  <button
                    type="button"
                    className="purchase-popup__payment-button purchase-popup__payment-button--pay"
                    onClick={handleCardPayment}
                    disabled={!confirmAge || isPaymentLoading}
                    aria-label={`Pay $${total.toFixed(2)}`}
                  >
                    {isPaymentLoading ? 'Processing...' : `Pay $${total.toFixed(2)}`}
                  </button>

                  <div className="purchase-popup__payment-powered">
                    <span>Powered by </span>
                    <span className="purchase-popup__payment-powered-logo">YooKassa</span>
                  </div>
                </div>
              </div>
            )}

            {!isCardFormOpen && (
              <div className="purchase-popup__payment-powered">
                <span>Powered by </span>
                <span className="purchase-popup__payment-powered-logo">YooKassa</span>
              </div>
            )}
          </div>

          <div className="purchase-popup__payment-actions">
            <button
              type="button"
              className="purchase-popup__link-button"
              onClick={onBackToCart}
              aria-label="Back to cart"
            >
              &lt; Back to cart
            </button>
          </div>
        </div>

        <div className="purchase-popup__checkout-summary">
          <h3 className="purchase-popup__checkout-summary-title">Order Summary</h3>

          <table className="purchase-popup__order-table">
            <thead>
              <tr>
                <th>DESC</th>
                <th>QTY</th>
                <th>PRICE</th>
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
                      <div className="purchase-popup__order-item-type">Single download</div>
                    </div>
                  </div>
                </td>
                <td>1</td>
                <td>C${subtotal.toFixed(2)}</td>
              </tr>
            </tbody>
          </table>

          <div className="purchase-popup__discount">
            <div className="purchase-popup__discount-input-wrapper">
              <input
                type="text"
                className="purchase-popup__discount-input"
                placeholder="Discount code or gift card"
                value={discountCode}
                onChange={(e) => setDiscountCode(e.target.value)}
              />
              <button type="button" className="purchase-popup__discount-button">
                Apply
              </button>
            </div>
          </div>

          <div className="purchase-popup__checkout-totals">
            <div className="purchase-popup__checkout-subtotal">
              Subtotal <span>C${subtotal.toFixed(2)}</span>
            </div>
            <div className="purchase-popup__checkout-total">
              Total <span>C${total.toFixed(2)}</span>
            </div>
          </div>

          <div className="purchase-popup__checkout-back-link">
            <button
              type="button"
              className="purchase-popup__link-button"
              onClick={onBackToCart}
              aria-label="Back to site"
            >
              &lt; Back to{' '}
              {typeof window !== 'undefined'
                ? window.location.hostname.replace('www.', '')
                : 'site'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export function PurchasePopup({
  isOpen,
  album,
  onClose,
  onRemove,
  onContinueShopping,
  onRegister,
}: PurchasePopupProps) {
  const [step, setStep] = useState<Step>('cart');
  const [checkoutFormData, setCheckoutFormData] = useState<CheckoutFormData>({
    email: '',
    firstName: '',
    lastName: '',
    notes: '',
    joinMailingList: false,
    agreeToOffer: false,
    agreeToPrivacy: false,
  });
  const [discountCode, setDiscountCode] = useState('');

  const handleCheckout = () => {
    setStep('checkout');
  };

  const handleBackToCart = () => {
    setStep('cart');
  };

  const handleContinueToPayment = () => {
    setStep('payment');
  };

  const handleBackToCheckout = () => {
    setStep('checkout');
  };

  // Сбрасываем шаг при закрытии попапа
  React.useEffect(() => {
    if (!isOpen) {
      setStep('cart');
    }
  }, [isOpen]);

  return (
    <Popup isActive={isOpen} onClose={onClose} bgColor="rgba(var(--deep-black-rgb) / 95%)">
      <Hamburger isActive onToggle={onClose} />
      <div className="purchase-popup">
        <div className="purchase-popup__container">
          {step === 'cart' ? (
            <CartStep
              album={album}
              onRemove={onRemove}
              onContinueShopping={onContinueShopping}
              onCheckout={handleCheckout}
            />
          ) : step === 'checkout' ? (
            <CheckoutStep
              album={album}
              onBackToCart={handleBackToCart}
              onContinueToPayment={handleContinueToPayment}
              formData={checkoutFormData}
              onFormDataChange={setCheckoutFormData}
            />
          ) : (
            <PaymentStep
              album={album}
              onBackToCart={handleBackToCart}
              onBackToCheckout={handleBackToCheckout}
              formData={checkoutFormData}
              onEditCustomerInfo={handleBackToCheckout}
              discountCode={discountCode}
            />
          )}
        </div>
      </div>
    </Popup>
  );
}

export default PurchasePopup;
