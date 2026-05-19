/**
 * GET /api/get-subscription-payment-status?paymentId=
 * Poll platform Premium payment; sync subscription activation on success.
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
import { getYooKassaEnvCredentials } from './lib/yookassa-env';
import {
  amountsEqual,
  fetchPaymentFromYooKassaApi,
  metaString,
} from './lib/yookassa-webhook-verify';
import {
  fulfillSubscriptionPayment,
  getSubscriptionPaymentForUser,
  getSubscriptionPaymentByInternalId,
  PREMIUM_SUBSCRIPTION_PLAN,
  PREMIUM_SUBSCRIPTION_PRODUCT_TYPE,
  getPremiumSubscriptionAmountRub,
  updateSubscriptionPaymentStatus,
} from './lib/subscription-billing';

dns.setDefaultResultOrder('ipv4first');

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const handler: Handler = async (event: HandlerEvent) => {
  if (event.httpMethod === 'OPTIONS') {
    return createOptionsResponse();
  }

  if (event.httpMethod !== 'GET') {
    return createErrorResponse(405, 'Method not allowed. Use GET.');
  }

  const userId = getUserIdFromEvent(event);
  if (!userId) {
    return unauthorizedFromAuthHeader(event);
  }

  const paymentIdParam = event.queryStringParameters?.paymentId?.trim();
  const subscriptionPaymentIdParam = event.queryStringParameters?.subscriptionPaymentId?.trim();

  if (!paymentIdParam && !subscriptionPaymentIdParam) {
    return createErrorResponse(400, 'paymentId or subscriptionPaymentId parameter is required');
  }
  if (paymentIdParam && subscriptionPaymentIdParam) {
    return createErrorResponse(400, 'Provide either paymentId or subscriptionPaymentId, not both');
  }

  let paymentId = paymentIdParam;
  if (!paymentId && subscriptionPaymentIdParam) {
    if (!UUID_RE.test(subscriptionPaymentIdParam)) {
      return createErrorResponse(400, 'subscriptionPaymentId must be a valid UUID');
    }
    const pending = await getSubscriptionPaymentByInternalId(subscriptionPaymentIdParam, userId);
    if (!pending) {
      return createErrorResponse(404, 'Subscription payment not found');
    }
    if (!pending.provider_payment_id) {
      return createSuccessResponse({
        payment: {
          id: null,
          status: pending.status,
          paid: false,
          amount: { value: pending.amount, currency: pending.currency },
          metadata: {
            productType: PREMIUM_SUBSCRIPTION_PRODUCT_TYPE,
            userId,
            plan: pending.plan,
          },
        },
        subscriptionActivated: false,
      });
    }
    paymentId = pending.provider_payment_id;
  }

  if (!paymentId || !UUID_RE.test(paymentId)) {
    return createErrorResponse(400, 'paymentId must be a valid UUID');
  }

  const owned = await getSubscriptionPaymentForUser(paymentId, userId);
  if (!owned) {
    return createErrorResponse(404, 'Subscription payment not found');
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

  const apiResult = await fetchPaymentFromYooKassaApi(
    paymentId,
    yookassaCreds.shopId,
    yookassaCreds.secretKey
  );

  if (!apiResult.ok) {
    return createErrorResponse(
      apiResult.status === 404 ? 404 : 502,
      'Failed to fetch payment status from provider'
    );
  }

  const api = apiResult.payment;
  const metaUserId = metaString(api.metadata, 'userId');
  const productType = metaString(api.metadata, 'productType');
  const plan = metaString(api.metadata, 'plan');

  if (productType !== PREMIUM_SUBSCRIPTION_PRODUCT_TYPE) {
    return createErrorResponse(400, 'Not a premium subscription payment');
  }
  if (!metaUserId || metaUserId !== userId) {
    return createErrorResponse(403, 'Payment does not belong to this user');
  }
  if (plan && plan !== PREMIUM_SUBSCRIPTION_PLAN) {
    return createErrorResponse(400, 'Unexpected subscription plan');
  }
  if (!amountsEqual(api.amount.value, getPremiumSubscriptionAmountRub().toFixed(2))) {
    return createErrorResponse(400, 'Payment amount mismatch');
  }

  let subscriptionActivated = false;

  if (api.status === 'succeeded') {
    await updateSubscriptionPaymentStatus(paymentId, 'succeeded');
    await fulfillSubscriptionPayment({ userId, providerPaymentId: paymentId });
    subscriptionActivated = true;
  } else if (api.status === 'canceled') {
    await updateSubscriptionPaymentStatus(paymentId, 'canceled');
  } else if (api.status === 'waiting_for_capture') {
    await updateSubscriptionPaymentStatus(paymentId, 'waiting_for_capture');
  } else if (api.status === 'pending') {
    await updateSubscriptionPaymentStatus(paymentId, 'pending');
  }

  return createSuccessResponse({
    payment: {
      id: api.id,
      status: api.status,
      paid: api.status === 'succeeded',
      amount: api.amount,
      metadata: {
        productType,
        userId: metaUserId,
        plan: plan ?? PREMIUM_SUBSCRIPTION_PLAN,
      },
      confirmation_url:
        (api.status === 'pending' || api.status === 'waiting_for_capture') &&
        (api as { confirmation?: { confirmation_url?: string } }).confirmation?.confirmation_url
          ? (api as { confirmation?: { confirmation_url?: string } }).confirmation!.confirmation_url
          : undefined,
    },
    subscriptionActivated,
  });
};
