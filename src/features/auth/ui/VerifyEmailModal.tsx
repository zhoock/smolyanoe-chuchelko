import { useState } from 'react';
import { Popup } from '@shared/ui/popup';
import { resendVerificationEmail } from '@shared/lib/auth';
import { useAuthSessionUser } from '@shared/lib/hooks/useAuthSessionUser';
import { useEmailVerificationCopy, useResendCooldown } from '@shared/lib/emailVerification';
import { ChangeEmailModal } from './ChangeEmailModal';
import '@shared/lib/emailVerification/style.scss';

interface VerifyEmailModalProps {
  isOpen: boolean;
  onContinueLater: () => void;
  onClose?: () => void;
}

export function VerifyEmailModal({ isOpen, onContinueLater, onClose }: VerifyEmailModalProps) {
  const user = useAuthSessionUser();
  const copy = useEmailVerificationCopy();
  const { remaining, isCoolingDown, startCooldown } = useResendCooldown();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showChangeEmail, setShowChangeEmail] = useState(false);

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

  const resendLabel = isCoolingDown ? `${copy.resendEmail} (${remaining}s)` : copy.resendEmail;

  if (showChangeEmail) {
    return (
      <ChangeEmailModal
        isOpen={isOpen}
        onBack={() => setShowChangeEmail(false)}
        onClose={onClose ?? onContinueLater}
      />
    );
  }

  return (
    <Popup
      isActive={isOpen}
      onClose={onClose ?? onContinueLater}
      bgColor="rgba(var(--deep-black-rgb) / 95%)"
    >
      <div className="email-verify-modal">
        <div className="email-verify-modal__icon email-verify-modal__icon--gold" aria-hidden>
          ✉
        </div>
        <h2 className="email-verify-modal__title">{copy.verifyTitle}</h2>
        <p className="email-verify-modal__body">
          {copy.verifyBody}
          {user?.email ? (
            <>
              {' '}
              <span className="email-verify-modal__email">{user.email}</span>
            </>
          ) : null}
        </p>
        {error ? <div className="email-verify-modal__error">{error}</div> : null}
        <div className="email-verify-modal__actions">
          <button
            type="button"
            className="email-verify-modal__primary"
            onClick={handleResend}
            disabled={loading || isCoolingDown}
          >
            {loading ? '…' : resendLabel}
          </button>
          <button
            type="button"
            className="email-verify-modal__secondary"
            onClick={() => setShowChangeEmail(true)}
          >
            {copy.changeEmail}
          </button>
          <button type="button" className="email-verify-modal__link" onClick={onContinueLater}>
            {copy.continueLater}
          </button>
        </div>
      </div>
    </Popup>
  );
}
