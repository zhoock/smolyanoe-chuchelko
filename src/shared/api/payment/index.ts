/**
 * API для работы с платежами через ЮKassa.
 */

export interface CreatePaymentRequest {
  amount: number;
  currency?: string;
  description: string;
  albumId: string;
  customerEmail: string;
  returnUrl?: string;
  userId?: string; // ID музыканта-продавца (опционально, если нет - используется аккаунт платформы)
  paymentToken?: string; // Токен от Checkout.js для оплаты на сайте
  billingData?: {
    firstName: string;
    lastName: string;
    phone?: string;
    country?: string;
    zip?: string;
  };
}

export interface CreatePaymentResponse {
  success: boolean;
  paymentId?: string;
  confirmationUrl?: string;
  orderId?: string;
  error?: string;
  message?: string;
}

// Экспорт типов и утилит
export type { PaymentProvider, UserPaymentSettings, PaymentSettingsResponse } from './types';
export { getPaymentSettings, savePaymentSettings, disconnectPaymentProvider } from './settings';

/**
 * Получает Shop ID платформы YooKassa для Checkout.js
 * @returns Promise с Shop ID или ошибкой
 */
export async function getYooKassaShopId(): Promise<{ shopId?: string; error?: string }> {
  try {
    const response = await fetch('/api/yookassa-shop-id', {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({
        error: `HTTP ${response.status}: ${response.statusText}`,
      }));
      return { error: errorData.error || `HTTP ${response.status}` };
    }

    const data = await response.json();
    if (data.success && data.shopId) {
      return { shopId: data.shopId };
    }

    return { error: data.error || 'Shop ID not found' };
  } catch (error) {
    console.error('Error getting YooKassa Shop ID:', error);
    return {
      error: error instanceof Error ? error.message : 'Unknown error occurred',
    };
  }
}

/**
 * Создает платеж через ЮKassa API.
 * @param data - Данные для создания платежа
 * @returns Promise с результатом создания платежа
 */
export async function createPayment(data: CreatePaymentRequest): Promise<CreatePaymentResponse> {
  try {
    const response = await fetch('/api/create-payment', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({
        error: `HTTP ${response.status}: ${response.statusText}`,
      }));
      return {
        success: false,
        error: errorData.error || `HTTP ${response.status}`,
        message: errorData.message,
      };
    }

    const result: CreatePaymentResponse = await response.json();
    return result;
  } catch (error) {
    console.error('Error creating payment:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
    };
  }
}
