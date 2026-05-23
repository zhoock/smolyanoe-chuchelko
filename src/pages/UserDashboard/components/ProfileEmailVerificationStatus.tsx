import { useAppSelector } from '@shared/lib/hooks/useAppSelector';
import { useLang } from '@app/providers/lang';
import { selectUiDictionaryFirst } from '@shared/model/uiDictionary';
import './ProfileEmailVerificationStatus.scss';

type ProfileEmailVerificationStatusProps = {
  verified: boolean;
};

function IconVerified() {
  return (
    <svg
      className="profile-email-verification__icon"
      viewBox="0 0 16 16"
      width="16"
      height="16"
      fill="none"
      aria-hidden
    >
      <circle cx="8" cy="8" r="7" stroke="currentColor" strokeWidth="1.25" />
      <path
        d="M5 8.2 7 10.2 11 6"
        stroke="currentColor"
        strokeWidth="1.25"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconUnverified() {
  return (
    <svg
      className="profile-email-verification__icon"
      viewBox="0 0 16 16"
      width="16"
      height="16"
      fill="none"
      aria-hidden
    >
      <circle cx="8" cy="8" r="7" stroke="currentColor" strokeWidth="1.25" />
      <path d="M8 5v4M8 11.2v.8" stroke="currentColor" strokeWidth="1.35" strokeLinecap="round" />
    </svg>
  );
}

export function ProfileEmailVerificationStatus({ verified }: ProfileEmailVerificationStatusProps) {
  const { lang } = useLang();
  const ui = useAppSelector((state) => selectUiDictionaryFirst(state, lang));
  const copy = ui?.dashboard?.profileFields?.emailVerification;

  if (verified) {
    return (
      <div
        className="profile-email-verification profile-email-verification--verified"
        role="status"
      >
        <IconVerified />
        <span>{copy?.verified ?? 'Verified'}</span>
      </div>
    );
  }

  return (
    <div
      className="profile-email-verification profile-email-verification--unverified"
      role="status"
    >
      <div className="profile-email-verification__row">
        <IconUnverified />
        <span className="profile-email-verification__title">
          {copy?.notVerified ?? 'Email not verified'}
        </span>
      </div>
      <p className="profile-email-verification__hint">
        {copy?.notVerifiedHint ??
          'Please verify your email to unlock all features and secure your account.'}
      </p>
    </div>
  );
}
