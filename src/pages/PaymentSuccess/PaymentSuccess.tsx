// src/pages/PaymentSuccess/PaymentSuccess.tsx
import React, { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import './PaymentSuccess.style.scss';

/**
 * Статус платежа от YooKassa API
 * ВАЖНО: Всегда проверяем статус через YooKassa API, не доверяем БД
 */
interface PaymentStatus {
  id: string;
  status: 'pending' | 'waiting_for_capture' | 'succeeded' | 'canceled';
  paid: boolean;
  amount: {
    value: string;
    currency: string;
  };
  cancellation_details?: {
    party: string;
    reason: string;
  };
  metadata?: {
    orderId?: string;
    customerEmail?: string;
    [key: string]: string | undefined;
  };
  confirmation_url?: string; // URL для продолжения оплаты для pending статусов
}

interface StatusInfo {
  title: string;
  message: string;
  icon: string;
  className: string;
}

/**
 * Проверяет, является ли строка YooKassa paymentId
 * YooKassa paymentId имеет формат: UUID с дефисами, например 30e6...-000f-...
 */
function isYooKassaPaymentId(value: string): boolean {
  // YooKassa paymentId обычно содержит паттерн типа -000f- или -5000- в середине
  // И имеет формат UUID с дефисами
  return (
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value) &&
    (value.includes('-000f-') || value.includes('-5000-') || value.includes('-5001-'))
  );
}

/**
 * Проверяет, является ли строка UUID заказа (наш формат)
 */
function isOrderUUID(value: string): boolean {
  // Наши UUID заказов - стандартный UUID формат
  return (
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value) &&
    !isYooKassaPaymentId(value)
  );
}

function PaymentSuccess() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const paymentIdParam = searchParams.get('paymentId');
  const orderIdParam = searchParams.get('orderId');
  const [payment, setPayment] = useState<PaymentStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pollingCount, setPollingCount] = useState(0);
  const maxPollingAttempts = 20; // ~1.5 минуты (20 * 5 секунд)
  const pollingInterval = 5000; // 5 секунд для более быстрого обновления

  /**
   * Проверяет статус платежа через YooKassa API
   * ВАЖНО: Не доверяем странице success/failure, всегда проверяем через API
   */
  const fetchPaymentStatus = async () => {
    // Определяем параметр для запроса
    let apiParam = '';
    if (paymentIdParam) {
      // Если передан paymentId напрямую
      apiParam = `paymentId=${encodeURIComponent(paymentIdParam)}`;
    } else if (orderIdParam) {
      // Если передан orderId, проверяем формат
      if (isYooKassaPaymentId(orderIdParam)) {
        // Это YooKassa paymentId, переданный как orderId
        apiParam = `paymentId=${encodeURIComponent(orderIdParam)}`;
      } else if (isOrderUUID(orderIdParam)) {
        // Это наш UUID заказа
        apiParam = `orderId=${encodeURIComponent(orderIdParam)}`;
      } else {
        // Неизвестный формат, пробуем как orderId
        apiParam = `orderId=${encodeURIComponent(orderIdParam)}`;
      }
    } else {
      setError('Payment ID or Order ID is missing');
      setLoading(false);
      return;
    }

    try {
      // Используем get-payment-status, который проверяет через YooKassa API
      const response = await fetch(`/api/get-payment-status?${apiParam}`);

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();

      if (!data.success) {
        setError(data.error || 'Failed to fetch payment status');
        setLoading(false);
        return;
      }

      if (!data.payment) {
        setError('Payment not found');
        setLoading(false);
        return;
      }

      setPayment(data.payment);
      setLoading(false);

      // Маппинг статусов YooKassa
      const yookassaStatus = data.payment.status;
      const isFinalStatus = yookassaStatus === 'succeeded' || yookassaStatus === 'canceled';

      // Если платеж завершен (succeeded или canceled), прекращаем polling
      if (isFinalStatus) {
        return;
      }

      // Продолжаем polling для pending статусов
      if (
        (yookassaStatus === 'pending' || yookassaStatus === 'waiting_for_capture') &&
        pollingCount < maxPollingAttempts
      ) {
        setTimeout(() => {
          setPollingCount((prev) => prev + 1);
          fetchPaymentStatus();
        }, pollingInterval);
      } else if (pollingCount >= maxPollingAttempts) {
        setError('Payment status check timeout. Please refresh the page or contact support.');
      }
    } catch (err) {
      console.error('Error fetching payment status:', err);

      // Продолжаем попытки, если не исчерпаны все попытки
      if (pollingCount < maxPollingAttempts) {
        // Не показываем ошибку, продолжаем polling
        setTimeout(() => {
          setPollingCount((prev) => prev + 1);
          fetchPaymentStatus();
        }, pollingInterval);
      } else {
        // Все попытки исчерпаны - показываем ошибку
        const errorMessage =
          err instanceof Error
            ? `Ошибка соединения: ${err.message}. Проверьте подключение к интернету.`
            : 'Не удалось получить статус платежа. Попробуйте обновить страницу.';
        setError(errorMessage);
        setLoading(false);
      }
    }
  };

  useEffect(() => {
    if (paymentIdParam || orderIdParam) {
      fetchPaymentStatus();
    } else {
      setError('Payment ID or Order ID is missing');
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paymentIdParam, orderIdParam]);

  /**
   * Маппинг статусов YooKassa в UI сообщения
   */
  const getStatusMessage = (paymentData: PaymentStatus): StatusInfo => {
    switch (paymentData.status) {
      case 'succeeded':
        return {
          title: 'Оплата успешна!',
          message: 'Ваш заказ успешно оплачен. Спасибо за покупку!',
          icon: '✅',
          className: 'payment-success__status--paid',
        };
      case 'pending':
      case 'waiting_for_capture':
        return {
          title: 'Обработка платежа...',
          message: 'Пожалуйста, подождите. Мы обрабатываем ваш платеж.',
          icon: '⏳',
          className: 'payment-success__status--pending',
        };
      case 'canceled':
        return {
          title: 'Платеж отменен',
          message: paymentData.cancellation_details?.reason
            ? `Платеж был отменен: ${paymentData.cancellation_details.reason}`
            : 'Платеж был отменен. Вы можете попробовать оплатить снова.',
          icon: '❌',
          className: 'payment-success__status--canceled',
        };
      default:
        return {
          title: 'Неизвестный статус',
          message: `Статус платежа: ${paymentData.status}`,
          icon: '❓',
          className: 'payment-success__status--unknown',
        };
    }
  };

  return (
    <>
      <Helmet>
        <title>Статус оплаты — Смоляное Чучелко</title>
      </Helmet>
      <div className="payment-success">
        <div className="payment-success__container">
          {loading ? (
            <div className="payment-success__loading">
              <div className="payment-success__spinner" />
              <p>Загрузка статуса заказа...</p>
            </div>
          ) : error ? (
            <div className="payment-success__error">
              <h1>Ошибка</h1>
              <p>{error}</p>
              <button
                type="button"
                className="payment-success__button"
                onClick={() => window.location.reload()}
              >
                Обновить страницу
              </button>
            </div>
          ) : payment ? (
            (() => {
              const statusInfo = getStatusMessage(payment);
              const isPending =
                payment.status === 'pending' || payment.status === 'waiting_for_capture';
              const isSucceeded = payment.status === 'succeeded';
              const isCanceled = payment.status === 'canceled';

              return (
                <div className={`payment-success__status ${statusInfo.className}`}>
                  <h1 className="payment-success__title">{statusInfo.title}</h1>
                  <p className="payment-success__message">{statusInfo.message}</p>

                  {isSucceeded && (
                    <div className="payment-success__details">
                      <p>
                        <strong>Сумма:</strong> {payment.amount.value} {payment.amount.currency}
                      </p>
                      {payment.metadata?.customerEmail && (
                        <p>
                          <strong>Email:</strong> {payment.metadata.customerEmail}
                        </p>
                      )}
                      {payment.metadata?.orderId && (
                        <p>
                          <strong>Номер заказа:</strong> {payment.metadata.orderId}
                        </p>
                      )}
                    </div>
                  )}

                  {isPending && (
                    <div className="payment-success__pending-actions">
                      {payment.confirmation_url ? (
                        <>
                          <a
                            href={payment.confirmation_url}
                            className="payment-success__button payment-success__button--primary"
                            target="_self"
                            rel="noopener noreferrer"
                          >
                            Продолжить оплату
                          </a>
                          {pollingCount < maxPollingAttempts && (
                            <div className="payment-success__polling">
                              <p>
                                Проверка статуса... ({pollingCount + 1}/{maxPollingAttempts})
                              </p>
                              <p className="payment-success__polling-note">
                                Это может занять несколько минут
                              </p>
                            </div>
                          )}
                        </>
                      ) : (
                        <>
                          {pollingCount < maxPollingAttempts && (
                            <div className="payment-success__polling">
                              <p>
                                Проверка статуса... ({pollingCount + 1}/{maxPollingAttempts})
                              </p>
                              <p className="payment-success__polling-note">
                                Это может занять несколько минут
                              </p>
                            </div>
                          )}
                          <button
                            type="button"
                            className="payment-success__button"
                            onClick={() => navigate('/')}
                          >
                            Вернуться на главную
                          </button>
                        </>
                      )}
                    </div>
                  )}

                  {isCanceled && (
                    <button
                      type="button"
                      className="payment-success__button"
                      onClick={() => navigate('/')}
                    >
                      Вернуться на главную
                    </button>
                  )}

                  {isSucceeded && (
                    <div className="payment-success__success-actions">
                      {payment.metadata?.customerEmail && (
                        <button
                          type="button"
                          className="payment-success__button payment-success__button--primary"
                          onClick={() => navigate('/dashboard-new?tab=my-purchases')}
                        >
                          Мои покупки
                        </button>
                      )}
                      <button
                        type="button"
                        className="payment-success__button"
                        onClick={() => navigate('/')}
                      >
                        На главную
                      </button>
                    </div>
                  )}
                </div>
              );
            })()
          ) : (
            <div className="payment-success__error">
              <h1>Заказ не найден</h1>
              <p>Не удалось найти информацию о заказе.</p>
              <button
                type="button"
                className="payment-success__button"
                onClick={() => navigate('/')}
              >
                Вернуться на главную
              </button>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

export default PaymentSuccess;
