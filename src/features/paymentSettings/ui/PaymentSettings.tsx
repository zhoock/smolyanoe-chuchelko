import React from 'react';
import { usePaymentSettings } from '../model/usePaymentSettings';
import { PAYMENT_PROVIDERS } from '../lib/constants';
import './PaymentSettings.style.scss';

interface PaymentSettingsProps {
  userId: string;
}

export function PaymentSettings({ userId }: PaymentSettingsProps) {
  const {
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
    handleConnect,
    handleDisconnect,
  } = usePaymentSettings(userId);

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
      <div className="payment-settings__header">
        <h2 className="payment-settings__title">ЮKassa</h2>
      </div>

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

      <div className="payment-settings__description">
        <p>Разрешите Людям Оплачивать Покупки На Вашем Сайте Через ЮKassa</p>
        <p>
          Для получения платежей вам потребуется бизнес-счёт ЮKassa. Если у вас есть личный счёт, вы
          можете бесплатно обновить его. Вы можете использовать один и тот же счёт ЮKassa Business
          для нескольких аккаунтов для совершения продаж.
        </p>
      </div>

      <div className="payment-settings__providers-list">
        {PAYMENT_PROVIDERS.map(renderProviderCard)}
      </div>
    </div>
  );
}
