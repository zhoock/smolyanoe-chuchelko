import { useState, useEffect, useMemo } from 'react';
import { useNavigate, useSearchParams, useLocation } from 'react-router-dom';
import {
  isAuthenticated,
  isEmailVerified,
  getUser,
  AUTH_EXPIRED_BANNER_SESSION_KEY,
} from '@shared/lib/auth';
import { resolvePostAuthDestination } from '@shared/lib/authReturnUrl';
import {
  clearAccountDeletedSession,
  clearAccountDeletedSkipReturn,
  shouldLeaveDeletedArtistPage,
} from '@shared/lib/accountDeletedSession';
import { useAuthSessionUser } from '@shared/lib/hooks/useAuthSessionUser';
import { useLang } from '@app/providers/lang';
import { LoginForm } from './LoginForm';
import { RegisterForm } from './RegisterForm';
import { LanguageSelectModal } from './LanguageSelectModal';
import { VerifyEmailModal } from './VerifyEmailModal';
import './AuthPage.scss';

type AuthMode = 'login' | 'register';

export function AuthPage() {
  const [searchParams] = useSearchParams();
  const location = useLocation();
  const user = useAuthSessionUser();
  const [mode, setMode] = useState<AuthMode>(() =>
    searchParams.get('mode') === 'register' ? 'register' : 'login'
  );
  const [showLanguageModal, setShowLanguageModal] = useState(false);
  const [showVerifyEmailModal, setShowVerifyEmailModal] = useState(() =>
    Boolean((location.state as { showVerifyEmail?: boolean } | null)?.showVerifyEmail)
  );
  const [pendingPostRegister, setPendingPostRegister] = useState(false);
  const [sessionExpiredMessage, setSessionExpiredMessage] = useState<string | null>(null);
  const navigate = useNavigate();
  const { setLang } = useLang();

  const needsVerification = Boolean(user && !isEmailVerified(user));

  const postAuthPath = useMemo(
    () =>
      resolvePostAuthDestination({
        returnToSearchParam: searchParams.get('returnTo'),
        routerState: location.state,
      }),
    [searchParams, location.state]
  );

  useEffect(() => {
    try {
      const msg = sessionStorage.getItem(AUTH_EXPIRED_BANNER_SESSION_KEY);
      if (msg) {
        setSessionExpiredMessage(msg);
        sessionStorage.removeItem(AUTH_EXPIRED_BANNER_SESSION_KEY);
      }
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    const m = searchParams.get('mode');
    if (m === 'register') setMode('register');
    else if (m === 'login') setMode('login');
  }, [searchParams]);

  useEffect(() => {
    if (isAuthenticated() && !showLanguageModal && !showVerifyEmailModal && !needsVerification) {
      clearAccountDeletedSkipReturn();
      navigate(postAuthPath, { replace: true });
    }
  }, [navigate, showLanguageModal, showVerifyEmailModal, needsVerification, postAuthPath]);

  if (isAuthenticated() && !showLanguageModal && !showVerifyEmailModal && !needsVerification) {
    return null;
  }

  const handleRegisterSuccess = () => {
    setPendingPostRegister(true);
    setShowVerifyEmailModal(true);
  };

  const handleLoginSuccess = () => {
    const current = getUser();
    if (current && !isEmailVerified(current)) {
      setShowVerifyEmailModal(true);
      return;
    }
    setShowLanguageModal(true);
  };

  const finishPostAuthNavigation = () => {
    clearAccountDeletedSkipReturn();
    navigate(postAuthPath, { replace: true });
  };

  const handleVerifyContinueLater = () => {
    setShowVerifyEmailModal(false);
    if (pendingPostRegister) {
      setShowLanguageModal(true);
    } else {
      finishPostAuthNavigation();
    }
  };

  const handleLanguageSelected = (lang: 'ru' | 'en') => {
    setLang(lang);
    setShowLanguageModal(false);
    setPendingPostRegister(false);
    finishPostAuthNavigation();
  };

  const handleCloseLanguageModal = () => {
    setShowLanguageModal(false);
    setPendingPostRegister(false);
    finishPostAuthNavigation();
  };

  const showAuthForm = !showLanguageModal && !showVerifyEmailModal;

  const handleCloseAuth = () => {
    if (shouldLeaveDeletedArtistPage()) {
      clearAccountDeletedSession();
      navigate({ pathname: '/', search: '' }, { replace: true });
      return;
    }
    navigate(-1);
  };

  return (
    <>
      <VerifyEmailModal
        isOpen={showVerifyEmailModal && needsVerification}
        onContinueLater={handleVerifyContinueLater}
        onClose={handleVerifyContinueLater}
      />

      {showAuthForm && (
        <div className="auth-page">
          <div className="auth-page__backdrop" />
          <div className="auth-page__container">
            <button
              type="button"
              className="auth-page__close"
              aria-label="Закрыть"
              onClick={handleCloseAuth}
            >
              ×
            </button>
            {sessionExpiredMessage ? (
              <p className="auth-page__session-notice" role="status">
                {sessionExpiredMessage}
              </p>
            ) : null}
            {mode === 'login' ? (
              <LoginForm
                onSuccess={handleLoginSuccess}
                onSwitchToRegister={() => setMode('register')}
              />
            ) : (
              <RegisterForm
                onSuccess={handleRegisterSuccess}
                onSwitchToLogin={() => setMode('login')}
              />
            )}
          </div>
        </div>
      )}

      <LanguageSelectModal
        isOpen={showLanguageModal}
        onClose={handleCloseLanguageModal}
        onLanguageSelected={handleLanguageSelected}
      />
    </>
  );
}

export default AuthPage;
