import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { isAuthenticated, refreshAuthSession, resendVerificationEmail } from '@shared/lib/auth';
import {
  useEmailVerificationCopy,
  useResendCooldown,
  resolveVerificationEmailSend,
} from '@shared/lib/emailVerification';
import '@features/auth/ui/VerifyEmailModal.style.scss';

function WarningIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M12 9v4m0 4h.01M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="m5 12 5 5L20 7"
        stroke="currentColor"
        strokeWidth="1.85"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export default function EmailVerificationExpired() {
  const navigate = useNavigate();
  const copy = useEmailVerificationCopy();
  const { remaining, isCoolingDown, startCooldown } = useResendCooldown();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleSendNewLink = async () => {
    if (!isAuthenticated()) {
      navigate('/auth?mode=login', { replace: true });
      return;
    }
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
      // Sync auth state then route the user to the verified-success page.
      void refreshAuthSession();
      navigate('/email-verified', { replace: true });
      return;
    }
    setSuccess(false);
    setError(resolution.message);
  };

  const resendLabel = isCoolingDown ? `${copy.sendNewLink} (${remaining}s)` : copy.sendNewLink;

  return (
    <div className="email-verify-page">
      <Helmet>
        <title>{copy.expiredTitle}</title>
      </Helmet>
      <div className="verify-email-modal__container verify-email-modal__container--standalone">
        <div className="verify-email-modal__header">
          <div className="verify-email-modal__title-row">
            <span
              className="verify-email-modal__icon verify-email-modal__icon--error"
              aria-hidden="true"
            >
              <WarningIcon />
            </span>
            <h1 className="verify-email-modal__title">{copy.expiredTitle}</h1>
          </div>
        </div>
        <p className="verify-email-modal__message">{copy.expiredBody}</p>
        {success ? (
          <div className="verify-email-modal__success" role="status" aria-live="polite">
            <span className="verify-email-modal__success-icon" aria-hidden="true">
              <CheckIcon />
            </span>
            <div className="verify-email-modal__success-copy">
              <p className="verify-email-modal__success-title">{copy.verificationSentTitle}</p>
              <p className="verify-email-modal__success-body">{copy.verificationSentBody}</p>
            </div>
          </div>
        ) : null}
        {error ? (
          <div className="verify-email-modal__error" role="alert">
            {error}
          </div>
        ) : null}
        <div className="verify-email-modal__actions">
          <button
            type="button"
            className="verify-email-modal__button verify-email-modal__button--primary"
            onClick={handleSendNewLink}
            disabled={loading || isCoolingDown}
          >
            {loading ? copy.submitting : resendLabel}
          </button>
        </div>
        <button
          type="button"
          className="verify-email-modal__footer-link"
          onClick={() => navigate('/auth?mode=login', { replace: true })}
        >
          {copy.backToLogin}
        </button>
      </div>
    </div>
  );
}
