/**
 * API для работы с настройками платежей пользователей.
 */

import type { PaymentSettingsResponse, UserPaymentSettings, PaymentProvider } from './types';

export interface GetPaymentSettingsRequest {
  userId: string;
  provider?: PaymentProvider;
}

export interface SavePaymentSettingsRequest {
  userId: string;
  provider: PaymentProvider;
  shopId?: string;
  secretKey?: string;
  isActive?: boolean;
}

/**
 * Получить настройки платежей пользователя.
 */
export async function getPaymentSettings(
  request: GetPaymentSettingsRequest
): Promise<PaymentSettingsResponse> {
  try {
    const params = new URLSearchParams({
      userId: request.userId,
      ...(request.provider && { provider: request.provider }),
    });

    const response = await fetch(`/api/payment-settings?${params.toString()}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({
        error: `HTTP ${response.status}: ${response.statusText}`,
      }));
      return {
        success: false,
        error: errorData.error || `HTTP ${response.status}`,
      };
    }

    const result: PaymentSettingsResponse = await response.json();
    return result;
  } catch (error) {
    console.error('Error getting payment settings:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
    };
  }
}

/**
 * Сохранить настройки платежей пользователя.
 */
export async function savePaymentSettings(
  data: SavePaymentSettingsRequest
): Promise<PaymentSettingsResponse> {
  try {
    const response = await fetch('/api/payment-settings', {
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

    const result: PaymentSettingsResponse = await response.json();
    return result;
  } catch (error) {
    console.error('Error saving payment settings:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
    };
  }
}

/**
 * Отключить платежную систему.
 */
export async function disconnectPaymentProvider(
  userId: string,
  provider: PaymentProvider
): Promise<PaymentSettingsResponse> {
  try {
    const params = new URLSearchParams({
      userId,
      provider,
    });

    const response = await fetch(`/api/payment-settings?${params.toString()}`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
      },
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

    const result: PaymentSettingsResponse = await response.json();
    return result;
  } catch (error) {
    console.error('Error disconnecting payment provider:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
    };
  }
}
