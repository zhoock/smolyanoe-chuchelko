import { useState, useEffect, useCallback, type Dispatch, type SetStateAction } from 'react';
import {
  getPaymentSettings,
  savePaymentSettings,
  disconnectPaymentProvider,
} from '@shared/api/payment/settings';
import type { PaymentProvider, UserPaymentSettings } from '@shared/api/payment/types';
import { PAYMENT_PROVIDERS } from '../lib/constants';

interface UsePaymentSettingsReturn {
  settingsMap: Record<PaymentProvider, UserPaymentSettings | null>;
  loading: boolean;
  saving: PaymentProvider | null;
  error: string | null;
  success: string | null;
  activeProvider: PaymentProvider;
  shopId: string;
  secretKey: string;
  localShopId: Record<PaymentProvider, string>;
  localSecretKey: Record<PaymentProvider, string>;
  showForm: Record<PaymentProvider, boolean>;
  setActiveProvider: (provider: PaymentProvider) => void;
  setShopId: Dispatch<SetStateAction<string>>;
  setSecretKey: Dispatch<SetStateAction<string>>;
  setLocalShopId: Dispatch<SetStateAction<Record<PaymentProvider, string>>>;
  setLocalSecretKey: Dispatch<SetStateAction<Record<PaymentProvider, string>>>;
  setShowForm: Dispatch<SetStateAction<Record<PaymentProvider, boolean>>>;
  loadSettings: () => Promise<void>;
  handleConnect: (provider: PaymentProvider) => Promise<void>;
  handleDisconnect: (provider: PaymentProvider) => Promise<void>;
}

export function usePaymentSettings(userId: string): UsePaymentSettingsReturn {
  const [settingsMap, setSettingsMap] = useState<
    Record<PaymentProvider, UserPaymentSettings | null>
  >({
    yookassa: null,
    stripe: null,
    paypal: null,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<PaymentProvider | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [activeProvider, setActiveProvider] = useState<PaymentProvider>('yookassa');
  const [shopId, setShopId] = useState('');
  const [secretKey, setSecretKey] = useState('');
  const [localShopId, setLocalShopId] = useState<Record<PaymentProvider, string>>({
    yookassa: '',
    stripe: '',
    paypal: '',
  });
  const [localSecretKey, setLocalSecretKey] = useState<Record<PaymentProvider, string>>({
    yookassa: '',
    stripe: '',
    paypal: '',
  });
  const [showForm, setShowForm] = useState<Record<PaymentProvider, boolean>>({
    yookassa: false,
    stripe: false,
    paypal: false,
  });

  const loadSettings = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const providers: PaymentProvider[] = ['yookassa'];
      const results = await Promise.all(
        providers.map((provider) => getPaymentSettings({ userId, provider }))
      );

      const newSettingsMap: Record<PaymentProvider, UserPaymentSettings | null> = {
        yookassa: null,
        stripe: null,
        paypal: null,
      };

      providers.forEach((provider, index) => {
        const result = results[index];
        if (result.success && result.settings) {
          newSettingsMap[provider] = result.settings;
        }
      });

      setSettingsMap(newSettingsMap);

      // Устанавливаем shopId для активного провайдера
      const activeSettings = newSettingsMap[activeProvider];
      if (activeSettings) {
        setShopId(activeSettings.shopId || '');
      }
    } catch (err) {
      // Игнорируем ошибки загрузки, если это проблема с API
      const errorMessage = err instanceof Error ? err.message : 'Failed to load payment settings';
      if (!errorMessage.includes('netlify') && !errorMessage.includes('JSON')) {
        setError(errorMessage);
      }
    } finally {
      setLoading(false);
    }
  }, [userId, activeProvider]);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  const handleConnect = async (provider: PaymentProvider) => {
    if (!shopId.trim() || !secretKey.trim()) {
      setError('Пожалуйста, заполните все поля');
      return;
    }

    setSaving(provider);
    setError(null);
    setSuccess(null);

    try {
      const result = await savePaymentSettings({
        userId,
        provider,
        shopId: shopId.trim(),
        secretKey: secretKey.trim(),
        isActive: true,
      });

      if (result.success) {
        setSuccess(`${PAYMENT_PROVIDERS.find((p) => p.id === provider)?.name} успешно подключен!`);
        setSettingsMap((prev) => ({
          ...prev,
          [provider]: result.settings || null,
        }));
        setShowForm((prev) => ({ ...prev, [provider]: false }));
        setSecretKey(''); // Очищаем секретный ключ из формы (безопасность)
        await loadSettings();
      } else {
        setError(result.error || 'Failed to save payment settings');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save payment settings');
    } finally {
      setSaving(null);
    }
  };

  const handleDisconnect = async (provider: PaymentProvider) => {
    const providerName = PAYMENT_PROVIDERS.find((p) => p.id === provider)?.name || provider;
    if (
      !confirm(
        `Вы уверены, что хотите отключить ${providerName}? После этого вы не сможете принимать платежи через эту систему.`
      )
    ) {
      return;
    }

    setSaving(provider);
    setError(null);
    setSuccess(null);

    try {
      const result = await disconnectPaymentProvider(userId, provider);

      if (result.success) {
        setSuccess(`${providerName} успешно отключен`);
        setSettingsMap((prev) => ({ ...prev, [provider]: null }));
        setShopId('');
        setSecretKey('');
        setShowForm((prev) => ({ ...prev, [provider]: false }));
        await loadSettings();
      } else {
        setError(result.error || 'Failed to disconnect payment provider');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to disconnect payment provider');
    } finally {
      setSaving(null);
    }
  };

  return {
    settingsMap,
    loading,
    saving,
    error,
    success,
    activeProvider,
    shopId,
    secretKey,
    localShopId,
    localSecretKey,
    showForm,
    setActiveProvider,
    setShopId,
    setSecretKey,
    setLocalShopId,
    setLocalSecretKey,
    setShowForm,
    loadSettings,
    handleConnect,
    handleDisconnect,
  };
}
