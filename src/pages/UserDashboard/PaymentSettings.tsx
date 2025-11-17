import React, { useState, useEffect, useCallback } from 'react';
import {
  getPaymentSettings,
  savePaymentSettings,
  disconnectPaymentProvider,
} from '@shared/api/payment/settings';
import type { PaymentProvider, UserPaymentSettings } from '@shared/api/payment/types';
import './PaymentSettings.style.scss';

interface PaymentSettingsProps {
  userId: string;
}

const PAYMENT_PROVIDERS: Array<{
  id: PaymentProvider;
  name: string;
  logo: string;
  description: string;
  instructions: string;
  details: string;
}> = [
  {
    id: 'yookassa',
    name: 'ЮKassa',
    logo: '💳',
    description: 'Разрешите людям оплачивать покупки на вашем сайте через ЮKassa',
    details:
      'Для получения платежей вам потребуется бизнес-счёт ЮKassa. Если у вас есть личный счёт, вы можете бесплатно обновить его. Вы можете использовать один и тот же счёт ЮKassa Business для нескольких аккаунтов для совершения продаж.',
    instructions: `
      Для получения платежей вам потребуется бизнес-счёт ЮKassa.
      Если у вас есть личный счёт, вы можете бесплатно обновить его.
      
      Шаги для подключения:
      1. Зарегистрируйтесь на https://yookassa.ru/
      2. Заключите договор и создайте магазин
      3. Получите Shop ID в разделе "Настройки" → "Магазин"
      4. Выпустите Secret Key в разделе "Интеграция" → "Ключи API"
      5. Введите их в форму ниже
      6. Нажмите "Подключить"
    `,
  },
];

export function PaymentSettings({ userId }: PaymentSettingsProps) {
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

  const renderProviderCard = (provider: (typeof PAYMENT_PROVIDERS)[0]) => {
    const settings = settingsMap[provider.id];
    const isSaving = saving === provider.id;
    const isFormOpen = showForm[provider.id];

    return (
      <div key={provider.id} className="payment-settings__provider-card">
        <div className="payment-settings__provider-logo">{provider.name}</div>
        <h3 className="payment-settings__provider-heading">{provider.description}</h3>
        <p className="payment-settings__provider-details">{provider.details}</p>

        {settings && settings.isActive ? (
          <div className="payment-settings__connected">
            <div className="payment-settings__status">
              <span className="payment-settings__status-badge payment-settings__status-badge--connected">
                ✓ Подключено
              </span>
              {settings.connectedAt && (
                <span className="payment-settings__connected-date">
                  Подключено: {new Date(settings.connectedAt).toLocaleDateString('ru-RU')}
                </span>
              )}
            </div>
            <div className="payment-settings__shop-id">
              <strong>Shop ID:</strong> {settings.shopId}
            </div>
            <button
              type="button"
              className="payment-settings__disconnect-button"
              onClick={() => handleDisconnect(provider.id)}
              disabled={isSaving}
            >
              {isSaving ? 'Отключение...' : `Отключить ${provider.name}`}
            </button>
          </div>
        ) : (
          <div className="payment-settings__not-connected">
            {!isFormOpen ? (
              <>
                <div className="payment-settings__instructions">
                  <p>Для подключения вам нужно:</p>
                  <ol>
                    <li>Зарегистрироваться или войти в личный кабинет ЮKassa</li>
                    <li>Заключить договор и создать магазин</li>
                    <li>Найти Shop ID в разделе "Настройки" → "Магазин"</li>
                    <li>Выпустить Secret Key в разделе "Интеграция" → "Ключи API"</li>
                    <li>Ввести их в форму ниже</li>
                  </ol>
                  <p>
                    <a
                      href="https://yookassa.ru/"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="payment-settings__link"
                    >
                      Перейти на сайт ЮKassa для регистрации →
                    </a>
                  </p>
                </div>
                <button
                  type="button"
                  className="payment-settings__connect-button"
                  onClick={() => {
                    setShowForm((prev) => ({ ...prev, [provider.id]: true }));
                    setActiveProvider(provider.id);
                    setLocalShopId((prev) => ({ ...prev, [provider.id]: settings?.shopId || '' }));
                    setLocalSecretKey((prev) => ({ ...prev, [provider.id]: '' }));
                  }}
                >
                  Ввести Shop ID и Secret Key
                </button>
              </>
            ) : (
              <div className="payment-settings__form">
                <div className="payment-settings__form-field">
                  <label
                    htmlFor={`shop-id-${provider.id}`}
                    className="payment-settings__form-label"
                  >
                    Shop ID (ID магазина)
                  </label>
                  <input
                    type="text"
                    id={`shop-id-${provider.id}`}
                    className="payment-settings__form-input"
                    value={localShopId[provider.id] || ''}
                    onChange={(e) =>
                      setLocalShopId((prev) => ({ ...prev, [provider.id]: e.target.value }))
                    }
                    placeholder="Введите ваш Shop ID"
                    disabled={isSaving}
                  />
                  <small className="payment-settings__form-hint">
                    Shop ID находится в разделе "Настройки" → "Магазин" в личном кабинете ЮKassa
                  </small>
                </div>

                <div className="payment-settings__form-field">
                  <label
                    htmlFor={`secret-key-${provider.id}`}
                    className="payment-settings__form-label"
                  >
                    Secret Key (Секретный ключ)
                  </label>
                  <input
                    type="password"
                    id={`secret-key-${provider.id}`}
                    className="payment-settings__form-input"
                    value={localSecretKey[provider.id] || ''}
                    onChange={(e) =>
                      setLocalSecretKey((prev) => ({ ...prev, [provider.id]: e.target.value }))
                    }
                    placeholder="Введите ваш Secret Key"
                    disabled={isSaving}
                  />
                  <small className="payment-settings__form-hint">
                    Secret Key нужно выпустить в разделе "Интеграция" → "Ключи API". Важно: ключ
                    показывается только один раз — обязательно сохраните его!
                  </small>
                </div>

                <div className="payment-settings__form-actions">
                  <button
                    type="button"
                    className="payment-settings__cancel-button"
                    onClick={() => {
                      setShowForm((prev) => ({ ...prev, [provider.id]: false }));
                      setLocalShopId((prev) => ({
                        ...prev,
                        [provider.id]: settings?.shopId || '',
                      }));
                      setLocalSecretKey((prev) => ({ ...prev, [provider.id]: '' }));
                      setError(null);
                    }}
                    disabled={isSaving}
                  >
                    Отмена
                  </button>
                  <button
                    type="button"
                    className="payment-settings__save-button"
                    onClick={() => {
                      setShopId(localShopId[provider.id] || '');
                      setSecretKey(localSecretKey[provider.id] || '');
                      handleConnect(provider.id);
                    }}
                    disabled={
                      isSaving ||
                      !localShopId[provider.id]?.trim() ||
                      !localSecretKey[provider.id]?.trim()
                    }
                  >
                    {isSaving ? 'Подключение...' : 'Подключить'}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  if (loading) {
    return (
      <div className="payment-settings">
        <div className="payment-settings__loading">Загрузка...</div>
      </div>
    );
  }

  return (
    <div className="payment-settings">
      {error && (
        <div className="payment-settings__error" role="alert">
          <strong>Ошибка:</strong> {error}
        </div>
      )}

      {success && (
        <div className="payment-settings__success" role="alert">
          {success}
        </div>
      )}

      <div className="payment-settings__providers-list">
        {PAYMENT_PROVIDERS.map(renderProviderCard)}
      </div>
    </div>
  );
}
