/**
 * POST /api/create-subscription-payment
 * Platform Premium subscription checkout (one-shot, 149 RUB / 30 days).
 * Requires JWT. Does not touch album orders or artist credentials.
 */

import type { Handler, HandlerEvent } from '@netlify/functions';
import dns from 'node:dns';

import {
  createErrorResponse,
  createOptionsResponse,
  createSuccessResponse,
  getUserIdFromEvent,
  unauthorizedFromAuthHeader,
} from './lib/api-helpers';
import { query } from './lib/db';
import { getYooKassaEnvCredentials } from './lib/yookassa-env';
import {
  attachProviderPaymentId,
  createPendingSubscriptionPayment,
  PREMIUM_SUBSCRIPTION_PLAN,
  PREMIUM_SUBSCRIPTION_PRODUCT_TYPE,
  getPremiumSubscriptionAmountRub,
} from './lib/subscription-billing';

dns.setDefaultResultOrder('ipv4first');

interface CreateSubscriptionPaymentBody {
  returnUrl?: string;
}

interface YooKassaCreateResponse {
  id: string;
  status: string;
  confirmation?: {
    confirmation_url?: string;
  };
}

export const handler: Handler = async (event: HandlerEvent) => {
  if (event.httpMethod === 'OPTIONS') {
    return createOptionsResponse();
  }

  if (event.httpMethod !== 'POST') {
    return createErrorResponse(405, 'Method not allowed. Use POST.');
  }

  const userId = getUserIdFromEvent(event);
  if (!userId) {
    return unauthorizedFromAuthHeader(event);
  }

  const yookassaCreds = getYooKassaEnvCredentials();
  if (!yookassaCreds) {
    return createErrorResponse(
      503,
      'YooKassa is not configured. Set YOOKASSA_SHOP_ID and YOOKASSA_SECRET_KEY.',
      undefined,
      { code: 'YOOKASSA_NOT_CONFIGURED' }
    );
  }

  let body: CreateSubscriptionPaymentBody = {};
  try {
    body = JSON.parse(event.body || '{}') as CreateSubscriptionPaymentBody;
  } catch {
    return createErrorResponse(400, 'Invalid JSON body');
  }

  const userResult = await query<{ email: string }>(
    `SELECT email FROM users WHERE id = $1::uuid LIMIT 1`,
    [userId]
  );
  const customerEmail = userResult.rows[0]?.email?.trim();
  if (!customerEmail) {
    return createErrorResponse(400, 'User email is required for subscription checkout');
  }

  let subscriptionPaymentId: string;
  try {
    subscriptionPaymentId = await createPendingSubscriptionPayment(userId);
  } catch (error) {
    console.error('[create-subscription-payment] failed to create pending row', error);
    return createErrorResponse(500, 'Could not start subscription checkout');
  }

  const fallbackReturnUrl = 'https://smolyanoechuchelko.ru/pay/subscription-success';
  let refererOrigin: string | null = null;
  if (event.headers.referer) {
    try {
      refererOrigin = new URL(event.headers.referer).origin;
    } catch {
      refererOrigin = null;
    }
  }

  const requestedReturn =
    body.returnUrl?.trim() ||
    process.env.YOOKASSA_SUBSCRIPTION_RETURN_URL?.trim() ||
    process.env.YOOKASSA_RETURN_URL?.trim();

  const baseReturnUrl =
    requestedReturn ||
    (refererOrigin ? `${refererOrigin}/pay/subscription-success` : fallbackReturnUrl);

  let returnUrl: string;
  try {
    const urlObj = new URL(baseReturnUrl, refererOrigin || undefined);
    urlObj.searchParams.set('subscriptionPaymentId', subscriptionPaymentId);
    returnUrl = urlObj.toString();
  } catch {
    const fallback = new URL(fallbackReturnUrl);
    fallback.searchParams.set('subscriptionPaymentId', subscriptionPaymentId);
    returnUrl = fallback.toString();
  }

  const amountValue = getPremiumSubscriptionAmountRub().toFixed(2);
  const description = 'Premium Archive Subscription';

  const yookassaPayload = {
    amount: { value: amountValue, currency: 'RUB' },
    capture: true,
    confirmation: {
      type: 'redirect' as const,
      return_url: returnUrl,
    },
    description,
    metadata: {
      productType: PREMIUM_SUBSCRIPTION_PRODUCT_TYPE,
      userId,
      plan: PREMIUM_SUBSCRIPTION_PLAN,
    },
    receipt: {
      customer: { email: customerEmail },
      items: [
        {
          description,
          quantity: '1',
          amount: { value: amountValue, currency: 'RUB' },
          vat_code: 1,
          payment_subject: 'service',
          payment_mode: 'full_payment',
        },
      ],
    },
  };

  const apiUrl = process.env.YOOKASSA_API_URL || 'https://api.yookassa.ru/v3/payments';
  const authHeader = Buffer.from(`${yookassaCreds.shopId}:${yookassaCreds.secretKey}`).toString(
    'base64'
  );
  const idempotenceKey = `subscription-${subscriptionPaymentId}`;

  let yookassaResponse: Response;
  try {
    yookassaResponse = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Basic ${authHeader}`,
        'Idempotence-Key': idempotenceKey,
      },
      body: JSON.stringify(yookassaPayload),
    });
  } catch (error) {
    console.error('[create-subscription-payment] YooKassa fetch failed', error);
    return createErrorResponse(502, 'Payment provider unavailable');
  }

  if (!yookassaResponse.ok) {
    const errorText = await yookassaResponse.text();
    console.error('[create-subscription-payment] YooKassa error', {
      status: yookassaResponse.status,
      errorText: errorText.slice(0, 500),
    });
    return createErrorResponse(502, 'Failed to create subscription payment');
  }

  const paymentData = (await yookassaResponse.json()) as YooKassaCreateResponse;
  if (!paymentData.id) {
    return createErrorResponse(502, 'Invalid response from payment provider');
  }

  try {
    await attachProviderPaymentId(subscriptionPaymentId, paymentData.id);
  } catch (error) {
    console.error('[create-subscription-payment] failed to attach provider payment id', error);
  }

  console.log('[create-subscription-payment] created', {
    userIdSuffix: `…${userId.slice(-6)}`,
    paymentIdSuffix: `…${paymentData.id.slice(-6)}`,
    subscriptionPaymentIdSuffix: `…${subscriptionPaymentId.slice(-6)}`,
  });

  return createSuccessResponse({
    paymentId: paymentData.id,
    confirmationUrl: paymentData.confirmation?.confirmation_url || '',
  });
};
