import { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { refreshAuthSession } from '@shared/lib/auth';
import { sanitizeReturnPath } from '@shared/lib/authReturnUrl';
import { useEmailVerificationCopy } from '@shared/lib/emailVerification';
import './EmailVerified.scss';

const DASHBOARD_PATH = '/dashboard-new';

function CheckIcon() {
  return (
    <svg
      className="email-verified-page__icon-check"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M20 6 9 17l-5-5"
        stroke="currentColor"
        strokeWidth="1.25"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export default function EmailVerified() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const copy = useEmailVerificationCopy();

  useEffect(() => {
    void refreshAuthSession();
  }, []);

  const handleContinue = () => {
    const returnTo = sanitizeReturnPath(searchParams.get('returnTo'));
    navigate(returnTo ?? '/', { replace: true });
  };

  const handleOpenDashboard = () => {
    navigate(DASHBOARD_PATH, { replace: true });
  };

  return (
    <section className="email-verified-page" aria-labelledby="email-verified-title">
      <div className="email-verified-page__backdrop" aria-hidden="true" />
      <div className="email-verified-page__content">
        <Helmet>
          <title>{copy.successTitle}</title>
        </Helmet>

        <div className="email-verified-page__icon-ring" aria-hidden="true">
          <CheckIcon />
        </div>

        <h1 id="email-verified-title" className="email-verified-page__title">
          {copy.successTitle}
        </h1>

        <div className="email-verified-page__divider" aria-hidden="true" />

        <p className="email-verified-page__subtitle">{copy.successBody}</p>

        <button type="button" className="email-verified-page__cta" onClick={handleContinue}>
          <span>{copy.continueToHome}</span>
          <span className="email-verified-page__cta-arrow" aria-hidden="true">
            →
          </span>
        </button>

        <p className="email-verified-page__secondary">
          {copy.openDashboardPrefix}
          <button
            type="button"
            className="email-verified-page__secondary-link"
            onClick={handleOpenDashboard}
          >
            {copy.openDashboardLink}
          </button>
        </p>
      </div>
    </section>
  );
}
