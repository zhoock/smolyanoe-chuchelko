import { useState } from 'react';
import { ChangeEmailModal } from '@features/auth/ui/ChangeEmailModal';
import { isEmailVerified, refreshAuthSession, resendVerificationEmail } from '@shared/lib/auth';
import { useAuthSessionUser } from '@shared/lib/hooks/useAuthSessionUser';
import { useEmailVerificationCopy } from './useEmailVerificationCopy';
import { useResendCooldown } from './useResendCooldown';
import { resolveVerificationEmailSend } from './resolveVerificationEmailSendResult';
import './style.scss';

const BANNER_DISMISSED_KEY = 'email-verification-banner-dismissed';

function BannerIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="9.25" stroke="currentColor" strokeWidth="1.35" />
      <path
        d="M12 7.85 15.85 15.5H8.15L12 7.85Z"
        stroke="currentColor"
        strokeWidth="1.25"
        strokeLinejoin="round"
      />
      <path d="M12 10.35v2.35" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <circle cx="12" cy="14.65" r="0.55" fill="currentColor" />
    </svg>
  );
}

function BannerSubtitle({ template, email }: { template: string; email: string }) {
  const parts = template.split('{{email}}');
  if (parts.length === 1) {
    return <p className="email-verification-banner__subtitle">{template}</p>;
  }

  return (
    <p className="email-verification-banner__subtitle">
      {parts[0]}
      <span className="email-verification-banner__email">{email}</span>
      {parts.slice(1).join('{{email}}')}
    </p>
  );
}

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
  const [success, setSuccess] = useState(false);
  const [showChangeEmail, setShowChangeEmail] = useState(false);

  if (!user || isEmailVerified(user) || dismissed) {
    return null;
  }

  const handleResend = async () => {
    if (isCoolingDown || loading) return;
    setLoading(true);
    setError(null);
    const result = await resendVerificationEmail();
    setLoading(false);
    const resolution = resolveVerificationEmailSend(result, copy, startCooldown);
    if (resolution.kind === 'success') {
      setSuccess(true);
      return;
    }
    if (resolution.kind === 'already-verified') {
      // Sync session — banner self-hides once isEmailVerified(user) becomes true.
      void refreshAuthSession();
      return;
    }
    setSuccess(false);
    setError(resolution.message);
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
    <>
      <section className="email-verification-banner" role="status" aria-live="polite">
        <div className="email-verification-banner__inner">
          <span className="email-verification-banner__icon" aria-hidden="true">
            <BannerIcon />
          </span>

          <div className="email-verification-banner__copy">
            <p className="email-verification-banner__title">{copy.bannerText}</p>
            <BannerSubtitle template={copy.bannerSubtitle} email={user.email} />
            {success ? (
              <p className="email-verification-banner__success">
                <span className="email-verification-banner__success-dot" aria-hidden="true" />
                {copy.verificationSentTitle}. {copy.verificationSentBody}
              </p>
            ) : null}
            {error ? (
              <p className="email-verification-banner__error" role="alert">
                {error}
              </p>
            ) : null}
          </div>

          <div className="email-verification-banner__actions">
            <button
              type="button"
              className="email-verification-banner__resend"
              onClick={handleResend}
              disabled={loading || isCoolingDown}
            >
              {loading ? copy.submitting : resendLabel}
            </button>
            <span className="email-verification-banner__actions-sep" aria-hidden="true">
              •
            </span>
            <button
              type="button"
              className="email-verification-banner__change-email"
              onClick={() => setShowChangeEmail(true)}
              disabled={loading}
            >
              {copy.changeEmail}
            </button>
          </div>

          <button
            type="button"
            className="email-verification-banner__close"
            onClick={handleDismiss}
            aria-label={copy.close}
          >
            ×
          </button>
        </div>
      </section>

      <ChangeEmailModal
        isOpen={showChangeEmail}
        onBack={() => setShowChangeEmail(false)}
        onClose={() => setShowChangeEmail(false)}
      />
    </>
  );
}
