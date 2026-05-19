/**
 * Premium subscription display price — mirrors netlify/functions/lib/subscription-billing.ts.
 */

export const PREMIUM_SUBSCRIPTION_AMOUNT_RUB_PRODUCTION = 149;

export function isPremiumSubscriptionDevTestPricing(): boolean {
  return (
    process.env.NODE_ENV !== 'production' ||
    process.env.YOOKASSA_TEST_MODE === 'true' ||
    process.env.NETLIFY_DEV === 'true'
  );
}

export function getPremiumSubscriptionAmountRub(): number {
  return isPremiumSubscriptionDevTestPricing() ? 1 : PREMIUM_SUBSCRIPTION_AMOUNT_RUB_PRODUCTION;
}

/** Price string for UI (modal, marketing copy). */
export function getPremiumSubscriptionPriceDisplayAmount(): string {
  return String(getPremiumSubscriptionAmountRub());
}
