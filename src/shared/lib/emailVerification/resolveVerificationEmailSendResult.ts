export type VerificationEmailSendResult = {
  success: boolean;
  error?: string;
  code?: string;
  retryAfterSeconds?: number;
};

type VerificationEmailSendCopy = {
  resendFailed: string;
  resendCooldown: string;
  resendRateLimited: string;
};

/**
 * Structured outcome of a verification-email request. Callers branch on `kind`:
 * - `success` — email accepted, show success state, kick off cooldown timer.
 * - `already-verified` — backend reports the email is already verified; the
 *   component should refresh the auth session and let the verification UI
 *   auto-hide instead of surfacing a raw backend error.
 * - `error` — show the localized `message` inline.
 */
export type VerificationEmailResolution =
  | { kind: 'success' }
  | { kind: 'already-verified' }
  | { kind: 'error'; message: string };

function formatResendCooldownMessage(template: string, seconds?: number): string {
  return template.replace('{{seconds}}', String(seconds ?? 60));
}

export function resolveVerificationEmailSend(
  result: VerificationEmailSendResult,
  copy: VerificationEmailSendCopy,
  startCooldown: (seconds?: number) => void
): VerificationEmailResolution {
  if (result.success) {
    startCooldown();
    return { kind: 'success' };
  }

  if (result.code === 'EMAIL_ALREADY_VERIFIED') {
    return { kind: 'already-verified' };
  }

  if (result.code === 'RESEND_COOLDOWN') {
    if (result.retryAfterSeconds != null) {
      startCooldown(result.retryAfterSeconds);
    }
    return {
      kind: 'error',
      message: formatResendCooldownMessage(copy.resendCooldown, result.retryAfterSeconds),
    };
  }

  if (result.code === 'RATE_LIMIT_EXCEEDED') {
    if (result.retryAfterSeconds != null) {
      startCooldown(result.retryAfterSeconds);
    }
    return { kind: 'error', message: copy.resendRateLimited };
  }

  return { kind: 'error', message: result.error || copy.resendFailed };
}

/**
 * Back-compat helper: collapses the structured resolution to the old
 * `string | null` contract (null on success or already-verified, otherwise
 * the localized error message). Prefer {@link resolveVerificationEmailSend}
 * in new code so callers can react to all outcomes explicitly.
 */
export function resolveVerificationEmailSendError(
  result: VerificationEmailSendResult,
  copy: VerificationEmailSendCopy,
  startCooldown: (seconds?: number) => void
): string | null {
  const resolution = resolveVerificationEmailSend(result, copy, startCooldown);
  if (resolution.kind === 'error') return resolution.message;
  return null;
}
