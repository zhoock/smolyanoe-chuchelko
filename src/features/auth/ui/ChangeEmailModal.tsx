import { useState, FormEvent } from 'react';
import { Popup } from '@shared/ui/popup';
import { changeVerificationEmail } from '@shared/lib/auth';
import { useAuthSessionUser } from '@shared/lib/hooks/useAuthSessionUser';
import { useEmailVerificationCopy } from '@shared/lib/emailVerification';
import '@shared/lib/emailVerification/style.scss';

interface ChangeEmailModalProps {
  isOpen: boolean;
  onBack: () => void;
  onClose: () => void;
}

export function ChangeEmailModal({ isOpen, onBack, onClose }: ChangeEmailModalProps) {
  const user = useAuthSessionUser();
  const copy = useEmailVerificationCopy();
  const [email, setEmail] = useState(user?.email ?? '');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    const trimmed = email.trim();
    if (!trimmed) {
      setError(copy.emailRequired);
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      setError(copy.emailInvalid);
      return;
    }
    setLoading(true);
    const result = await changeVerificationEmail(trimmed);
    setLoading(false);
    if (result.success) {
      onBack();
    } else {
      setError(result.error || copy.resendFailed);
    }
  };

  return (
    <Popup isActive={isOpen} onClose={onClose} bgColor="rgba(var(--deep-black-rgb) / 95%)">
      <form className="email-verify-modal" onSubmit={handleSubmit} noValidate>
        <button type="button" className="email-verify-modal__back" onClick={onBack}>
          ← {copy.back}
        </button>
        <h2 className="email-verify-modal__title">{copy.changeEmailTitle}</h2>
        <p className="email-verify-modal__body">{copy.changeEmailBody}</p>
        {error ? <div className="email-verify-modal__error">{error}</div> : null}
        <div className="email-verify-modal__field">
          <label htmlFor="change-verification-email" className="email-verify-modal__label">
            {copy.newEmailLabel}
          </label>
          <input
            id="change-verification-email"
            type="email"
            className="email-verify-modal__input"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder={copy.newEmailPlaceholder}
            autoComplete="email"
            disabled={loading}
          />
        </div>
        <div className="email-verify-modal__actions">
          <button type="submit" className="email-verify-modal__primary" disabled={loading}>
            {loading ? '…' : copy.sendVerificationEmail}
          </button>
          <button type="button" className="email-verify-modal__secondary" onClick={onClose}>
            {copy.cancel}
          </button>
        </div>
      </form>
    </Popup>
  );
}
