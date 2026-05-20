import type { AuthUser } from '@shared/lib/auth';
import { isEmailVerified } from '@shared/lib/auth';

export type EmailVerificationGateReason =
  | 'premium'
  | 'upload'
  | 'payment-settings'
  | 'dashboard-publish';

export function requireEmailVerified(
  user: AuthUser | null | undefined,
  _reason?: EmailVerificationGateReason
): boolean {
  return isEmailVerified(user);
}
