import { useState } from 'react';

import { resendVerificationEmail } from '@shared/lib/auth';
import { useAuthSessionUser } from '@shared/lib/hooks/useAuthSessionUser';

import { LockIcon, SendIcon } from './EmailVerificationOnboarding.icons';
import type { EmailVerificationOnboardingContext } from './EmailVerificationOnboarding.types';
import { getEmailVerificationOnboardingBody } from './getEmailVerificationOnboardingBody';
import { useEmailVerificationCopy } from './useEmailVerificationCopy';
import { useResendCooldown } from './useResendCooldown';
import './EmailVerificationOnboarding.scss';

type EmailVerificationOnboardingProps = {
  context: EmailVerificationOnboardingContext;
};

function formatEmailFootnote(template: string, email: string): string {
  return template.replace('{{email}}', email);
}

export function EmailVerificationOnboarding({ context }: EmailVerificationOnboardingProps) {
  const user = useAuthSessionUser();
  const copy = useEmailVerificationCopy();
  const { remaining, isCoolingDown, startCooldown } = useResendCooldown();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const body = getEmailVerificationOnboardingBody(copy, context);
  const sendLabel = isCoolingDown
    ? `${copy.sendConfirmationEmail} (${remaining}s)`
    : copy.sendConfirmationEmail;

  const handleSend = async () => {
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

  return (
    <div
      className="email-verification-onboarding"
      role="region"
      aria-labelledby="email-onboarding-title"
    >
      <div className="email-verification-onboarding__inner">
        <div className="email-verification-onboarding__hero" aria-hidden="true">
          <span className="email-verification-onboarding__lock-ring">
            <LockIcon />
          </span>
        </div>

        <h2 id="email-onboarding-title" className="email-verification-onboarding__title">
          {copy.verifyTitle}
        </h2>

        <p className="email-verification-onboarding__message">{body}</p>

        {error ? <div className="email-verification-onboarding__error">{error}</div> : null}

        <button
          type="button"
          className="email-verification-onboarding__button"
          onClick={handleSend}
          disabled={loading || isCoolingDown}
        >
          <SendIcon />
          <span>{loading ? '…' : sendLabel}</span>
        </button>

        {user?.email ? (
          <p className="email-verification-onboarding__footnote">
            {formatEmailFootnote(copy.emailWillBeSentTo, user.email)}
          </p>
        ) : null}
      </div>
    </div>
  );
}
