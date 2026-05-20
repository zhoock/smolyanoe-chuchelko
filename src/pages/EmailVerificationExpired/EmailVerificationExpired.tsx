import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { isAuthenticated, resendVerificationEmail } from '@shared/lib/auth';
import { useEmailVerificationCopy, useResendCooldown } from '@shared/lib/emailVerification';
import '@shared/lib/emailVerification/style.scss';

export default function EmailVerificationExpired() {
  const navigate = useNavigate();
  const copy = useEmailVerificationCopy();
  const { remaining, isCoolingDown, startCooldown } = useResendCooldown();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
    if (result.success) {
      startCooldown();
      navigate('/auth', { replace: true, state: { showVerifyEmail: true } });
    } else {
      setError(result.error || copy.resendFailed);
    }
  };

  const resendLabel = isCoolingDown ? `${copy.sendNewLink} (${remaining}s)` : copy.sendNewLink;

  return (
    <div className="email-verify-page">
      <Helmet>
        <title>{copy.expiredTitle}</title>
      </Helmet>
      <div className="email-verify-modal__icon email-verify-modal__icon--error" aria-hidden>
        !
      </div>
      <h1 className="email-verify-modal__title">{copy.expiredTitle}</h1>
      <p className="email-verify-modal__body">{copy.expiredBody}</p>
      {error ? <div className="email-verify-modal__error">{error}</div> : null}
      <div className="email-verify-modal__actions">
        <button
          type="button"
          className="email-verify-modal__primary"
          onClick={handleSendNewLink}
          disabled={loading || isCoolingDown}
        >
          {loading ? '…' : resendLabel}
        </button>
        <button
          type="button"
          className="email-verify-modal__link"
          onClick={() => navigate('/auth?mode=login', { replace: true })}
        >
          {copy.backToLogin}
        </button>
      </div>
    </div>
  );
}
