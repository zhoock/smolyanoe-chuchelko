/**
 * Типы для работы с платежными системами.
 */

export type PaymentProvider = 'yookassa' | 'stripe' | 'paypal';

export interface UserPaymentSettings {
  userId: string;
  provider: PaymentProvider;
  shopId?: string;
  secretKey?: string; // Зашифровано
  isActive: boolean;
  connectedAt?: string;
  lastUsedAt?: string;
}

export interface ConnectPaymentProviderRequest {
  userId: string;
  provider: PaymentProvider;
  authorizationCode?: string; // Для OAuth
  shopId?: string; // Для ручного ввода (не рекомендуется)
  secretKey?: string; // Для ручного ввода (не рекомендуется)
}

export interface ConnectPaymentProviderResponse {
  success: boolean;
  settings?: UserPaymentSettings;
  error?: string;
  message?: string;
}

export interface PaymentSettingsResponse {
  success: boolean;
  settings?: UserPaymentSettings;
  error?: string;
  message?: string;
}
