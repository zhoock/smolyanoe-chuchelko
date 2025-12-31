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
      const contentType = response.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        const errorData = await response.json().catch(() => ({
          error: `HTTP ${response.status}: ${response.statusText}`,
        }));
        return {
          success: false,
          error: errorData.error || `HTTP ${response.status}`,
        };
      } else {
        return {
          success: false,
          error:
            'Сервер вернул неверный формат данных. Убедитесь, что Netlify Functions запущены (netlify dev).',
        };
      }
    }

    const contentType = response.headers.get('content-type');
    if (!contentType || !contentType.includes('application/json')) {
      return {
        success: false,
        error:
          'Сервер вернул неверный формат данных. Убедитесь, что Netlify Functions запущены (netlify dev).',
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
    console.log('📤 Saving payment settings:', {
      userId: data.userId,
      provider: data.provider,
      hasShopId: !!data.shopId,
      hasSecretKey: !!data.secretKey,
    });

    const response = await fetch('/api/payment-settings', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const contentType = response.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        const errorData = await response.json().catch(() => ({
          error: `HTTP ${response.status}: ${response.statusText}`,
        }));
        console.error('❌ Payment settings save error:', {
          status: response.status,
          statusText: response.statusText,
          error: errorData.error,
          message: errorData.message,
          fullResponse: errorData,
        });
        return {
          success: false,
          error: errorData.error || `HTTP ${response.status}`,
          message: errorData.message || errorData.error,
        };
      } else {
        const errorText = await response.text().catch(() => 'Unknown error');
        console.error('❌ Payment settings save error (non-JSON):', {
          status: response.status,
          statusText: response.statusText,
          text: errorText,
        });
        return {
          success: false,
          error:
            'Сервер вернул неверный формат данных. Убедитесь, что Netlify Functions запущены (netlify dev).',
        };
      }
    }

    const contentType = response.headers.get('content-type');
    if (!contentType || !contentType.includes('application/json')) {
      return {
        success: false,
        error:
          'Сервер вернул неверный формат данных. Убедитесь, что Netlify Functions запущены (netlify dev).',
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
      const contentType = response.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        const errorData = await response.json().catch(() => ({
          error: `HTTP ${response.status}: ${response.statusText}`,
        }));
        return {
          success: false,
          error: errorData.error || `HTTP ${response.status}`,
          message: errorData.message,
        };
      } else {
        return {
          success: false,
          error:
            'Сервер вернул неверный формат данных. Убедитесь, что Netlify Functions запущены (netlify dev).',
        };
      }
    }

    const contentType = response.headers.get('content-type');
    if (!contentType || !contentType.includes('application/json')) {
      return {
        success: false,
        error:
          'Сервер вернул неверный формат данных. Убедитесь, что Netlify Functions запущены (netlify dev).',
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
