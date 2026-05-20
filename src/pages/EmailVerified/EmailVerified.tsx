import { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { refreshAuthSession } from '@shared/lib/auth';
import { useEmailVerificationCopy } from '@shared/lib/emailVerification';
import '@shared/lib/emailVerification/style.scss';

export default function EmailVerified() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const copy = useEmailVerificationCopy();

  useEffect(() => {
    void refreshAuthSession();
  }, []);

  const handleContinue = () => {
    const returnTo = searchParams.get('returnTo');
    if (returnTo && returnTo.startsWith('/')) {
      navigate(returnTo, { replace: true });
      return;
    }
    navigate('/', { replace: true });
  };

  return (
    <div className="email-verify-page">
      <Helmet>
        <title>{copy.successTitle}</title>
      </Helmet>
      <div className="email-verify-modal__icon email-verify-modal__icon--success" aria-hidden>
        ✓
      </div>
      <h1 className="email-verify-modal__title">{copy.successTitle}</h1>
      <p className="email-verify-modal__body">{copy.successBody}</p>
      <div className="email-verify-modal__actions">
        <button type="button" className="email-verify-modal__primary" onClick={handleContinue}>
          {copy.continue}
        </button>
      </div>
    </div>
  );
}
