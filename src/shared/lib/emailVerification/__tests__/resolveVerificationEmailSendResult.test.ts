import {
  resolveVerificationEmailSend,
  resolveVerificationEmailSendError,
} from '../resolveVerificationEmailSendResult';

const copy = {
  resendFailed: 'Could not send email. Try again later.',
  resendCooldown: 'Please wait {{seconds}} seconds before requesting another email.',
  resendRateLimited: 'Too many requests. Please try again later.',
};

describe('resolveVerificationEmailSend', () => {
  let startCooldown: jest.Mock;

  beforeEach(() => {
    startCooldown = jest.fn();
  });

  it('returns success and starts the default cooldown', () => {
    const resolution = resolveVerificationEmailSend({ success: true }, copy, startCooldown);

    expect(resolution).toEqual({ kind: 'success' });
    expect(startCooldown).toHaveBeenCalledTimes(1);
    expect(startCooldown).toHaveBeenCalledWith();
  });

  it('handles RESEND_COOLDOWN with retryAfterSeconds and formats the message', () => {
    const resolution = resolveVerificationEmailSend(
      { success: false, code: 'RESEND_COOLDOWN', retryAfterSeconds: 42 },
      copy,
      startCooldown
    );

    expect(resolution).toEqual({
      kind: 'error',
      message: 'Please wait 42 seconds before requesting another email.',
    });
    expect(startCooldown).toHaveBeenCalledWith(42);
  });

  it('falls back to "60" in the cooldown message when retryAfterSeconds is missing', () => {
    const resolution = resolveVerificationEmailSend(
      { success: false, code: 'RESEND_COOLDOWN' },
      copy,
      startCooldown
    );

    expect(resolution).toEqual({
      kind: 'error',
      message: 'Please wait 60 seconds before requesting another email.',
    });
    expect(startCooldown).not.toHaveBeenCalled();
  });

  it('handles RATE_LIMIT_EXCEEDED with localized message and syncs the cooldown', () => {
    const resolution = resolveVerificationEmailSend(
      {
        success: false,
        code: 'RATE_LIMIT_EXCEEDED',
        error: 'Too many requests. Please try again later.',
        retryAfterSeconds: 1800,
      },
      copy,
      startCooldown
    );

    expect(resolution).toEqual({
      kind: 'error',
      message: 'Too many requests. Please try again later.',
    });
    expect(startCooldown).toHaveBeenCalledWith(1800);
  });

  it('does not call startCooldown for RATE_LIMIT_EXCEEDED without retryAfterSeconds', () => {
    const resolution = resolveVerificationEmailSend(
      { success: false, code: 'RATE_LIMIT_EXCEEDED' },
      copy,
      startCooldown
    );

    expect(resolution.kind).toBe('error');
    expect(startCooldown).not.toHaveBeenCalled();
  });

  it('reports EMAIL_ALREADY_VERIFIED separately so callers can refresh the session', () => {
    const resolution = resolveVerificationEmailSend(
      { success: false, code: 'EMAIL_ALREADY_VERIFIED', error: 'Email is already verified' },
      copy,
      startCooldown
    );

    expect(resolution).toEqual({ kind: 'already-verified' });
    expect(startCooldown).not.toHaveBeenCalled();
  });

  it('falls back to copy.resendFailed when the backend gives no specific reason', () => {
    const resolution = resolveVerificationEmailSend({ success: false }, copy, startCooldown);

    expect(resolution).toEqual({
      kind: 'error',
      message: 'Could not send email. Try again later.',
    });
    expect(startCooldown).not.toHaveBeenCalled();
  });

  it('prefers backend error text when present for unhandled codes', () => {
    const resolution = resolveVerificationEmailSend(
      { success: false, error: 'Custom backend error' },
      copy,
      startCooldown
    );

    expect(resolution).toEqual({ kind: 'error', message: 'Custom backend error' });
  });
});

describe('resolveVerificationEmailSendError (back-compat helper)', () => {
  let startCooldown: jest.Mock;

  beforeEach(() => {
    startCooldown = jest.fn();
  });

  it('returns null for success', () => {
    expect(resolveVerificationEmailSendError({ success: true }, copy, startCooldown)).toBeNull();
    expect(startCooldown).toHaveBeenCalledTimes(1);
  });

  it('returns null for already-verified (callers should handle it via the structured API)', () => {
    expect(
      resolveVerificationEmailSendError(
        { success: false, code: 'EMAIL_ALREADY_VERIFIED' },
        copy,
        startCooldown
      )
    ).toBeNull();
  });

  it('returns the localized rate-limited message for RATE_LIMIT_EXCEEDED', () => {
    expect(
      resolveVerificationEmailSendError(
        { success: false, code: 'RATE_LIMIT_EXCEEDED', retryAfterSeconds: 60 },
        copy,
        startCooldown
      )
    ).toBe('Too many requests. Please try again later.');
    expect(startCooldown).toHaveBeenCalledWith(60);
  });
});
