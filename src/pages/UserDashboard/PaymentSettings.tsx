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
}> = [
  {
    id: 'yookassa',
    name: 'ЮKassa',
    logo: '💳',
    description: 'Подключите свой аккаунт ЮKassa, чтобы получать платежи напрямую.',
    instructions: `
      Для получения платежей вам потребуется бизнес-счёт ЮKassa.
      Если у вас есть личный счёт, вы можете бесплатно обновить его.
      
      Шаги для подключения:
      1. Зарегистрируйтесь на https://yookassa.ru/
      2. Заключите договор и получите shopId и secretKey
      3. Введите их в форму ниже
      4. Нажмите "Подключить"
    `,
  },
];

export function PaymentSettings({ userId }: PaymentSettingsProps) {
  const [settings, setSettings] = useState<UserPaymentSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [shopId, setShopId] = useState('');
  const [secretKey, setSecretKey] = useState('');
  const [showForm, setShowForm] = useState(false);

  const loadSettings = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const result = await getPaymentSettings({ userId, provider: 'yookassa' });

      if (result.success && result.settings) {
        setSettings(result.settings);
        setShopId(result.settings.shopId || '');
      } else if (result.error) {
        setError(result.error);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load payment settings');
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  const handleConnect = async () => {
    if (!shopId.trim() || !secretKey.trim()) {
      setError('Пожалуйста, заполните все поля');
      return;
    }

    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const result = await savePaymentSettings({
        userId,
        provider: 'yookassa',
        shopId: shopId.trim(),
        secretKey: secretKey.trim(),
        isActive: true,
      });

      if (result.success) {
        setSuccess('Настройки платежей успешно сохранены!');
        setSettings(result.settings || null);
        setShowForm(false);
        setSecretKey(''); // Очищаем секретный ключ из формы (безопасность)
      } else {
        setError(result.error || 'Failed to save payment settings');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save payment settings');
    } finally {
      setSaving(false);
    }
  };

  const handleDisconnect = async () => {
    if (
      !confirm(
        'Вы уверены, что хотите отключить ЮKassa? После этого вы не сможете принимать платежи.'
      )
    ) {
      return;
    }

    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const result = await disconnectPaymentProvider(userId, 'yookassa');

      if (result.success) {
        setSuccess('ЮKassa успешно отключен');
        setSettings(null);
        setShopId('');
        setSecretKey('');
        setShowForm(false);
      } else {
        setError(result.error || 'Failed to disconnect payment provider');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to disconnect payment provider');
    } finally {
      setSaving(false);
    }
  };

  const provider = PAYMENT_PROVIDERS[0]; // ЮKassa

  if (loading) {
    return (
      <div className="payment-settings">
        <div className="payment-settings__loading">Загрузка...</div>
      </div>
    );
  }

  return (
    <div className="payment-settings">
      <h2 className="payment-settings__title">Настройки платежей</h2>

      {error && (
        <div className="payment-settings__error" role="alert">
          {error}
        </div>
      )}

      {success && (
        <div className="payment-settings__success" role="alert">
          {success}
        </div>
      )}

      <div className="payment-settings__provider">
        <div className="payment-settings__provider-header">
          <div className="payment-settings__provider-logo">{provider.logo}</div>
          <div className="payment-settings__provider-info">
            <h3 className="payment-settings__provider-name">{provider.name}</h3>
            <p className="payment-settings__provider-description">{provider.description}</p>
          </div>
        </div>

        {settings && settings.isActive ? (
          <div className="payment-settings__connected">
            <div className="payment-settings__status">
              <span className="payment-settings__status-badge payment-settings__status-badge--connected">
                Подключено
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
              onClick={handleDisconnect}
              disabled={saving}
            >
              {saving ? 'Отключение...' : 'Отключить'}
            </button>
          </div>
        ) : (
          <div className="payment-settings__not-connected">
            {!showForm ? (
              <>
                <div className="payment-settings__instructions">
                  <p>{provider.instructions}</p>
                  <p>
                    <a
                      href="https://yookassa.ru/"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="payment-settings__link"
                    >
                      Зарегистрироваться в ЮKassa →
                    </a>
                  </p>
                </div>
                <button
                  type="button"
                  className="payment-settings__connect-button"
                  onClick={() => setShowForm(true)}
                >
                  Подключить ЮKassa
                </button>
              </>
            ) : (
              <div className="payment-settings__form">
                <div className="payment-settings__form-field">
                  <label htmlFor="shop-id" className="payment-settings__form-label">
                    Shop ID (ID магазина)
                  </label>
                  <input
                    type="text"
                    id="shop-id"
                    className="payment-settings__form-input"
                    value={shopId}
                    onChange={(e) => setShopId(e.target.value)}
                    placeholder="Введите ваш Shop ID"
                    disabled={saving}
                  />
                  <small className="payment-settings__form-hint">
                    Вы можете найти Shop ID в личном кабинете ЮKassa
                  </small>
                </div>

                <div className="payment-settings__form-field">
                  <label htmlFor="secret-key" className="payment-settings__form-label">
                    Secret Key (Секретный ключ)
                  </label>
                  <input
                    type="password"
                    id="secret-key"
                    className="payment-settings__form-input"
                    value={secretKey}
                    onChange={(e) => setSecretKey(e.target.value)}
                    placeholder="Введите ваш Secret Key"
                    disabled={saving}
                  />
                  <small className="payment-settings__form-hint">
                    Вы можете найти Secret Key в личном кабинете ЮKassa
                  </small>
                </div>

                <div className="payment-settings__form-actions">
                  <button
                    type="button"
                    className="payment-settings__cancel-button"
                    onClick={() => {
                      setShowForm(false);
                      setShopId(settings?.shopId || '');
                      setSecretKey('');
                      setError(null);
                    }}
                    disabled={saving}
                  >
                    Отмена
                  </button>
                  <button
                    type="button"
                    className="payment-settings__save-button"
                    onClick={handleConnect}
                    disabled={saving || !shopId.trim() || !secretKey.trim()}
                  >
                    {saving ? 'Подключение...' : 'Подключить'}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
