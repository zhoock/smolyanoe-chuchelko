/**
 * Premium subscription billing (platform YooKassa) — isolated from album purchases.
 */

import { isMissingRelationError, query } from './db';
import type { Subscription } from './subscriptions';
import { mapSubscriptionRow, type SubscriptionRow } from './subscriptions';

export const PREMIUM_SUBSCRIPTION_PRODUCT_TYPE = 'premium_subscription';
export const PREMIUM_SUBSCRIPTION_PLAN = 'archive';
/** Production price; dev/test uses 1 RUB via getPremiumSubscriptionAmountRub(). */
export const PREMIUM_SUBSCRIPTION_AMOUNT_RUB_PRODUCTION = 149;
export const PREMIUM_SUBSCRIPTION_SLOTS_LIMIT = 3;
export const PREMIUM_SUBSCRIPTION_PERIOD_DAYS = 30;

export function isPremiumSubscriptionDevTestPricing(): boolean {
  return (
    process.env.NETLIFY_DEV === 'true' ||
    process.env.NODE_ENV !== 'production' ||
    process.env.YOOKASSA_TEST_MODE === 'true'
  );
}

export function getPremiumSubscriptionAmountRub(): number {
  return isPremiumSubscriptionDevTestPricing() ? 1 : PREMIUM_SUBSCRIPTION_AMOUNT_RUB_PRODUCTION;
}

/** @deprecated Use getPremiumSubscriptionAmountRub() */
export const PREMIUM_SUBSCRIPTION_AMOUNT_RUB = PREMIUM_SUBSCRIPTION_AMOUNT_RUB_PRODUCTION;

const SUBSCRIPTION_PAYMENT_STATUSES = [
  'pending',
  'waiting_for_capture',
  'succeeded',
  'canceled',
  'failed',
] as const;

export type SubscriptionPaymentStatus = (typeof SUBSCRIPTION_PAYMENT_STATUSES)[number];

export interface SubscriptionPaymentRow {
  id: string;
  user_id: string;
  provider: string;
  provider_payment_id: string | null;
  status: SubscriptionPaymentStatus;
  amount: string;
  currency: string;
  plan: string;
}

export async function createPendingSubscriptionPayment(userId: string): Promise<string> {
  const result = await query<{ id: string }>(
    `INSERT INTO subscription_payments (user_id, provider, status, amount, currency, plan)
     VALUES ($1, 'yookassa', 'pending', $2, 'RUB', $3)
     RETURNING id`,
    [userId, getPremiumSubscriptionAmountRub(), PREMIUM_SUBSCRIPTION_PLAN]
  );
  const id = result.rows[0]?.id;
  if (!id) throw new Error('Failed to create subscription payment row');
  return id;
}

export async function attachProviderPaymentId(
  subscriptionPaymentId: string,
  providerPaymentId: string
): Promise<void> {
  await query(
    `UPDATE subscription_payments
     SET provider_payment_id = $2, updated_at = CURRENT_TIMESTAMP
     WHERE id = $1`,
    [subscriptionPaymentId, providerPaymentId]
  );
}

export async function updateSubscriptionPaymentStatus(
  providerPaymentId: string,
  status: SubscriptionPaymentStatus
): Promise<void> {
  try {
    await query(
      `UPDATE subscription_payments
       SET status = $2, updated_at = CURRENT_TIMESTAMP
       WHERE provider = 'yookassa' AND provider_payment_id = $1`,
      [providerPaymentId, status]
    );
  } catch (error) {
    if (isMissingRelationError(error)) return;
    throw error;
  }
}

export async function getSubscriptionPaymentByProviderId(
  providerPaymentId: string
): Promise<SubscriptionPaymentRow | null> {
  try {
    const r = await query<SubscriptionPaymentRow>(
      `SELECT id, user_id, provider, provider_payment_id, status, amount::text AS amount, currency, plan
       FROM subscription_payments
       WHERE provider = 'yookassa' AND provider_payment_id = $1
       LIMIT 1`,
      [providerPaymentId]
    );
    return r.rows[0] ?? null;
  } catch (error) {
    if (isMissingRelationError(error)) return null;
    throw error;
  }
}

export async function getSubscriptionPaymentForUser(
  providerPaymentId: string,
  userId: string
): Promise<SubscriptionPaymentRow | null> {
  const row = await getSubscriptionPaymentByProviderId(providerPaymentId);
  if (!row || row.user_id !== userId) return null;
  return row;
}

export async function getSubscriptionPaymentByInternalId(
  subscriptionPaymentId: string,
  userId: string
): Promise<SubscriptionPaymentRow | null> {
  try {
    const r = await query<SubscriptionPaymentRow>(
      `SELECT id, user_id, provider, provider_payment_id, status, amount::text AS amount, currency, plan
       FROM subscription_payments
       WHERE id = $1 AND user_id = $2::uuid
       LIMIT 1`,
      [subscriptionPaymentId, userId]
    );
    return r.rows[0] ?? null;
  } catch (error) {
    if (isMissingRelationError(error)) return null;
    throw error;
  }
}

/**
 * Activate or renew platform Premium subscription after successful YooKassa payment.
 */
export async function fulfillSubscriptionPayment(params: {
  userId: string;
  providerPaymentId?: string | null;
}): Promise<Subscription> {
  const { userId, providerPaymentId } = params;

  const existing = await query<SubscriptionRow>(
    `SELECT
       id, user_id, status, plan, slots_limit, provider, provider_subscription_id,
       started_at, expires_at, created_at, updated_at
     FROM subscriptions
     WHERE user_id = $1::uuid
     ORDER BY created_at DESC
     LIMIT 1`,
    [userId]
  );

  const now = new Date();
  const expiresAt = new Date(now);
  expiresAt.setDate(expiresAt.getDate() + PREMIUM_SUBSCRIPTION_PERIOD_DAYS);

  const row = existing.rows[0];

  if (row) {
    const canReuse =
      row.status === 'expired' ||
      row.status === 'canceled' ||
      row.status === 'paused' ||
      row.status === 'trial';

    if (canReuse || row.status === 'active') {
      const updated = await query<SubscriptionRow>(
        `UPDATE subscriptions
         SET status = 'active',
             plan = $2,
             slots_limit = $3,
             provider = 'yookassa',
             provider_subscription_id = COALESCE($4, provider_subscription_id),
             started_at = CASE WHEN $5 THEN $6 ELSE started_at END,
             expires_at = $7,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $1
         RETURNING
           id, user_id, status, plan, slots_limit, provider, provider_subscription_id,
           started_at, expires_at, created_at, updated_at`,
        [
          row.id,
          PREMIUM_SUBSCRIPTION_PLAN,
          PREMIUM_SUBSCRIPTION_SLOTS_LIMIT,
          providerPaymentId ?? null,
          canReuse,
          now,
          expiresAt,
        ]
      );
      const next = updated.rows[0];
      if (!next) throw new Error('Failed to update subscription');
      return mapSubscriptionRow(next);
    }
  }

  const inserted = await query<SubscriptionRow>(
    `INSERT INTO subscriptions (
       user_id, status, plan, slots_limit, provider, provider_subscription_id, started_at, expires_at
     ) VALUES ($1::uuid, 'active', $2, $3, 'yookassa', $4, $5, $6)
     RETURNING
       id, user_id, status, plan, slots_limit, provider, provider_subscription_id,
       started_at, expires_at, created_at, updated_at`,
    [
      userId,
      PREMIUM_SUBSCRIPTION_PLAN,
      PREMIUM_SUBSCRIPTION_SLOTS_LIMIT,
      providerPaymentId ?? null,
      now,
      expiresAt,
    ]
  );

  const created = inserted.rows[0];
  if (!created) throw new Error('Failed to create subscription');
  return mapSubscriptionRow(created);
}
