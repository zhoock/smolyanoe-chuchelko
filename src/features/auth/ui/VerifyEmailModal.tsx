import { useState } from 'react';
import { Popup } from '@shared/ui/popup';
import { resendVerificationEmail } from '@shared/lib/auth';
import { useAuthSessionUser } from '@shared/lib/hooks/useAuthSessionUser';
import {
  useEmailVerificationCopy,
  useResendCooldown,
  resolveVerificationEmailSendError,
} from '@shared/lib/emailVerification';
import { ChangeEmailModal } from './ChangeEmailModal';
import './VerifyEmailModal.style.scss';

interface VerifyEmailModalProps {
  isOpen: boolean;
  onContinueLater: () => void;
  onClose?: () => void;
}

function MailIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="3" y="5" width="18" height="14" rx="2" stroke="currentColor" strokeWidth="1.75" />
      <path
        d="m3 7 9 6 9-6"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function VerifyEmailModal({ isOpen, onContinueLater, onClose }: VerifyEmailModalProps) {
  const user = useAuthSessionUser();
  const copy = useEmailVerificationCopy();
  const { remaining, isCoolingDown, startCooldown } = useResendCooldown();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showChangeEmail, setShowChangeEmail] = useState(false);

  const handleDismiss = onClose ?? onContinueLater;

  const handleResend = async () => {
    if (isCoolingDown || loading) return;
    setLoading(true);
    setError(null);
    const result = await resendVerificationEmail();
    setLoading(false);
    setError(resolveVerificationEmailSendError(result, copy, startCooldown));
  };

  const resendLabel = isCoolingDown ? `${copy.resendEmail} (${remaining}s)` : copy.resendEmail;

  if (showChangeEmail) {
    return (
      <ChangeEmailModal
        isOpen={isOpen}
        onBack={() => setShowChangeEmail(false)}
        onClose={handleDismiss}
      />
    );
  }

  return (
    <Popup
      isActive={isOpen}
      onClose={handleDismiss}
      closeBlocked={loading}
      bgColor="rgba(var(--deep-black-rgb) / 95%)"
    >
      <div className="verify-email-modal">
        <div className="verify-email-modal__container">
          <div className="verify-email-modal__header">
            <div className="verify-email-modal__title-row">
              <span className="verify-email-modal__icon" aria-hidden="true">
                <MailIcon />
              </span>
              <h2 className="verify-email-modal__title">{copy.verifyTitle}</h2>
            </div>
            <button
              type="button"
              className="verify-email-modal__close"
              onClick={handleDismiss}
              disabled={loading}
              aria-label={copy.close}
            >
              ×
            </button>
          </div>

          <p className="verify-email-modal__message">{copy.verifyBody}</p>
          {user?.email ? <p className="verify-email-modal__email">{user.email}</p> : null}
          {error ? <div className="verify-email-modal__error">{error}</div> : null}

          <div className="verify-email-modal__actions">
            <button
              type="button"
              className="verify-email-modal__button verify-email-modal__button--secondary"
              onClick={() => setShowChangeEmail(true)}
              disabled={loading}
            >
              {copy.changeEmail}
            </button>
            <button
              type="button"
              className="verify-email-modal__button verify-email-modal__button--primary"
              onClick={handleResend}
              disabled={loading || isCoolingDown}
            >
              {loading ? '…' : resendLabel}
            </button>
          </div>

          <button
            type="button"
            className="verify-email-modal__footer-link"
            onClick={onContinueLater}
          >
            {copy.continueLater}
          </button>
        </div>
      </div>
    </Popup>
  );
}
