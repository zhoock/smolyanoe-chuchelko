/**
 * Утилиты для валидации shopId и secretKey через тестовый запрос к ЮKassa API.
 */

interface YooKassaTestPaymentRequest {
  amount: {
    value: string;
    currency: string;
  };
  capture: boolean;
  description: string;
}

interface YooKassaTestPaymentResponse {
  id: string;
  status: string;
  amount: {
    value: string;
    currency: string;
  };
  description: string;
  created_at: string;
}

/**
 * Валидирует shopId и secretKey через тестовый запрос к ЮKassa API.
 * Создает тестовый платеж на минимальную сумму (1 копейка).
 *
 * @param shopId - ID магазина ЮKassa
 * @param secretKey - Секретный ключ ЮKassa
 * @returns true если валидация успешна, false если нет
 */
export async function validateYooKassaCredentials(
  shopId: string,
  secretKey: string
): Promise<{ valid: boolean; error?: string }> {
  if (!shopId || !secretKey) {
    return {
      valid: false,
      error: 'shopId and secretKey are required',
    };
  }

  try {
    // Используем production или test API
    // В тестовом режиме используйте: https://api.yookassa.ru/v3/payments
    const apiUrl = process.env.YOOKASSA_API_URL || 'https://api.yookassa.ru/v3/payments';

    // Создаем тестовый платеж на минимальную сумму (0.01 RUB = 1 копейка)
    const testPayment: YooKassaTestPaymentRequest = {
      amount: {
        value: '0.01',
        currency: 'RUB',
      },
      capture: false, // Не подтверждаем платеж (только создаем)
      description: 'Test payment for credentials validation',
    };

    // Создаем Basic Auth заголовок
    const authHeader = Buffer.from(`${shopId}:${secretKey}`).toString('base64');

    // Отправляем тестовый запрос к ЮKassa
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Basic ${authHeader}`,
        'Idempotence-Key': `validation-${Date.now()}-${Math.random()}`, // Уникальный ключ
      },
      body: JSON.stringify(testPayment),
    });

    if (!response.ok) {
      const errorText = await response.text();
      let errorMessage = `HTTP ${response.status}: ${response.statusText}`;

      try {
        const errorJson = JSON.parse(errorText);
        errorMessage = errorJson.description || errorJson.error || errorMessage;
      } catch {
        // Если не удалось распарсить JSON, используем текст ошибки
        errorMessage = errorText || errorMessage;
      }

      console.error('❌ YooKassa validation failed:', {
        status: response.status,
        error: errorMessage,
      });

      return {
        valid: false,
        error: errorMessage,
      };
    }

    const paymentData: YooKassaTestPaymentResponse = await response.json();

    // Проверяем, что платеж создан успешно
    if (paymentData.id && paymentData.status) {
      console.log('✅ YooKassa credentials validated successfully:', {
        paymentId: paymentData.id,
        status: paymentData.status,
      });

      // Отменяем тестовый платеж (опционально, но рекомендуется)
      // Можно вызвать API для отмены платежа, если нужно
      // await cancelTestPayment(shopId, secretKey, paymentData.id);

      return {
        valid: true,
      };
    }

    return {
      valid: false,
      error: 'Invalid response from YooKassa API',
    };
  } catch (error) {
    console.error('❌ YooKassa validation error:', error);

    return {
      valid: false,
      error: error instanceof Error ? error.message : 'Unknown error during validation',
    };
  }
}

/**
 * Отменяет тестовый платеж (опциональная функция).
 * Можно использовать для очистки тестовых платежей после валидации.
 */
async function cancelTestPayment(
  shopId: string,
  secretKey: string,
  paymentId: string
): Promise<void> {
  try {
    const apiUrl = `${process.env.YOOKASSA_API_URL || 'https://api.yookassa.ru/v3/payments'}/${paymentId}/cancel`;
    const authHeader = Buffer.from(`${shopId}:${secretKey}`).toString('base64');

    await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Basic ${authHeader}`,
        'Idempotence-Key': `cancel-${Date.now()}-${Math.random()}`,
      },
    });

    console.log('✅ Test payment cancelled:', paymentId);
  } catch (error) {
    console.warn('⚠️ Failed to cancel test payment:', error);
    // Не критично, если не удалось отменить
  }
}
