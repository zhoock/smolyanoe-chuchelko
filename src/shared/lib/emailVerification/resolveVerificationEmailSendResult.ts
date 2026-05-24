export type VerificationEmailSendResult = {
  success: boolean;
  error?: string;
  code?: string;
  retryAfterSeconds?: number;
};

type VerificationEmailSendCopy = {
  resendFailed: string;
  resendCooldown: string;
};

function formatResendCooldownMessage(template: string, seconds?: number): string {
  return template.replace('{{seconds}}', String(seconds ?? 60));
}

export function resolveVerificationEmailSendError(
  result: VerificationEmailSendResult,
  copy: VerificationEmailSendCopy,
  startCooldown: (seconds?: number) => void
): string | null {
  if (result.success) {
    startCooldown();
    return null;
  }

  if (result.code === 'RESEND_COOLDOWN') {
    if (result.retryAfterSeconds != null) {
      startCooldown(result.retryAfterSeconds);
    }
    return (
      result.error || formatResendCooldownMessage(copy.resendCooldown, result.retryAfterSeconds)
    );
  }

  return result.error || copy.resendFailed;
}
