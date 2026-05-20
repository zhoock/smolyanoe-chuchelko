import { useState } from 'react';
import { isEmailVerified, resendVerificationEmail } from '@shared/lib/auth';
import { useAuthSessionUser } from '@shared/lib/hooks/useAuthSessionUser';
import { useEmailVerificationCopy } from './useEmailVerificationCopy';
import { useResendCooldown } from './useResendCooldown';
import './style.scss';

const BANNER_DISMISSED_KEY = 'email-verification-banner-dismissed';

export function EmailVerificationBanner() {
  const user = useAuthSessionUser();
  const copy = useEmailVerificationCopy();
  const { remaining, isCoolingDown, startCooldown } = useResendCooldown();
  const [dismissed, setDismissed] = useState(() => {
    try {
      return sessionStorage.getItem(BANNER_DISMISSED_KEY) === '1';
    } catch {
      return false;
    }
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!user || isEmailVerified(user) || dismissed) {
    return null;
  }

  const handleResend = async () => {
    if (isCoolingDown || loading) return;
    setLoading(true);
    setError(null);
    const result = await resendVerificationEmail();
    setLoading(false);
    if (result.success) {
      startCooldown();
    } else {
      setError(result.error || copy.resendFailed);
    }
  };

  const handleDismiss = () => {
    try {
      sessionStorage.setItem(BANNER_DISMISSED_KEY, '1');
    } catch {
      /* ignore */
    }
    setDismissed(true);
  };

  const resendLabel = isCoolingDown ? `${copy.resendEmail} (${remaining}s)` : copy.resendEmail;

  return (
    <div className="email-verification-banner" role="status">
      <span className="email-verification-banner__icon" aria-hidden="true">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
          <path
            d="M12 9v4m0 4h.01M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z"
            stroke="currentColor"
            strokeWidth="1.75"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </span>
      <span className="email-verification-banner__text">{copy.bannerText}</span>
      <div className="email-verification-banner__actions">
        <button
          type="button"
          className="email-verification-banner__resend"
          onClick={handleResend}
          disabled={loading || isCoolingDown}
        >
          {loading ? '…' : resendLabel}
        </button>
        <button
          type="button"
          className="email-verification-banner__close"
          onClick={handleDismiss}
          aria-label={copy.close}
        >
          ×
        </button>
      </div>
      {error ? (
        <span
          className="email-verification-banner__text"
          style={{ color: 'var(--pink-terracotta)' }}
        >
          {error}
        </span>
      ) : null}
    </div>
  );
}
