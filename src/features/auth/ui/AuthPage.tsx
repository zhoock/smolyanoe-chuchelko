import { useState, useEffect, useMemo } from 'react';
import { useNavigate, useSearchParams, useLocation } from 'react-router-dom';
import {
  isAuthenticated,
  isEmailVerified,
  getUser,
  AUTH_EXPIRED_BANNER_SESSION_KEY,
} from '@shared/lib/auth';
import { isArtistAccount } from '@shared/lib/accountType';
import { markFirstArtistOnboardingPending } from '@shared/lib/authIntent';
import { resolvePostAuthDestination } from '@shared/lib/authReturnUrl';
import {
  clearAccountDeletedSession,
  clearAccountDeletedSkipReturn,
  shouldLeaveDeletedArtistPage,
} from '@shared/lib/accountDeletedSession';
import { useAuthSessionUser } from '@shared/lib/hooks/useAuthSessionUser';
import { LoginForm } from './LoginForm';
import { RegisterForm } from './RegisterForm';
import { RoleSelectionScreen } from './RoleSelectionScreen';
import { VerifyEmailModal } from './VerifyEmailModal';
import { ForgotPasswordForm } from './ForgotPasswordForm';
import type { AccountType } from '@shared/lib/accountType';
import './AuthPage.scss';
import './RoleSelectionScreen.scss';

type AuthMode = 'login' | 'register' | 'forgot';
type RegisterStep = 'role' | 'form';

/**
 * После успешного login/register пользователь сразу попадает на postAuthPath
 * (album page, checkout resume, /, …). Никакого onboarding-модала "выберите
 * язык" больше нет: язык определяется автоматически из `navigator.language`
 * (см. `@shared/lib/lang/detectBrowserLang`) и сохраняется при первом ручном
 * переключении в Header/Settings. Это убирает разрыв в conversion-flow
 * "купил → залогинился → внезапно language-modal".
 */
export function AuthPage() {
  const [searchParams] = useSearchParams();
  const location = useLocation();
  const user = useAuthSessionUser();
  const [mode, setMode] = useState<AuthMode>(() => {
    const m = searchParams.get('mode');
    if (m === 'register') return 'register';
    if (m === 'forgot') return 'forgot';
    return 'login';
  });
  const [registerStep, setRegisterStep] = useState<RegisterStep>('role');
  const [selectedAccountType, setSelectedAccountType] = useState<AccountType>('listener');
  const [forgotInitialEmail, setForgotInitialEmail] = useState('');
  const [showVerifyEmailModal, setShowVerifyEmailModal] = useState(() =>
    Boolean((location.state as { showVerifyEmail?: boolean } | null)?.showVerifyEmail)
  );
  const [sessionExpiredMessage, setSessionExpiredMessage] = useState<string | null>(null);
  const navigate = useNavigate();

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
    if (m === 'register') {
      setMode('register');
      setRegisterStep('role');
    } else if (m === 'login') {
      setMode('login');
    } else if (m === 'forgot') {
      setMode('forgot');
    }
  }, [searchParams]);

  useEffect(() => {
    if (isAuthenticated() && !showVerifyEmailModal && !needsVerification) {
      clearAccountDeletedSkipReturn();
      navigate(postAuthPath, { replace: true });
    }
  }, [navigate, showVerifyEmailModal, needsVerification, postAuthPath]);

  if (isAuthenticated() && !showVerifyEmailModal && !needsVerification) {
    return null;
  }

  const handleRegisterSuccess = () => {
    const registeredUser = getUser();
    if (registeredUser?.id && isArtistAccount(registeredUser)) {
      markFirstArtistOnboardingPending(registeredUser.id);
    }
    setShowVerifyEmailModal(true);
  };

  const finishPostAuthNavigation = () => {
    clearAccountDeletedSkipReturn();
    navigate(postAuthPath, { replace: true });
  };

  const handleLoginSuccess = () => {
    const current = getUser();
    if (current && !isEmailVerified(current)) {
      setShowVerifyEmailModal(true);
      return;
    }
    finishPostAuthNavigation();
  };

  const handleVerifyContinueLater = () => {
    setShowVerifyEmailModal(false);
    finishPostAuthNavigation();
  };

  const showAuthForm = !showVerifyEmailModal;
  const showRoleSelection = mode === 'register' && registerStep === 'role';

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
          <div
            className={`auth-page__container${showRoleSelection ? ' auth-page__container--wide' : ''}`}
          >
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
                onSwitchToRegister={() => {
                  setMode('register');
                  setRegisterStep('role');
                }}
                onForgotPassword={(currentEmail) => {
                  setForgotInitialEmail(currentEmail);
                  setMode('forgot');
                }}
              />
            ) : mode === 'forgot' ? (
              <ForgotPasswordForm
                initialEmail={forgotInitialEmail}
                onBackToLogin={() => setMode('login')}
              />
            ) : showRoleSelection ? (
              <RoleSelectionScreen
                onSelect={(accountType) => {
                  setSelectedAccountType(accountType);
                  setRegisterStep('form');
                }}
                onSwitchToLogin={() => setMode('login')}
              />
            ) : (
              <RegisterForm
                accountType={selectedAccountType}
                onSuccess={handleRegisterSuccess}
                onSwitchToLogin={() => setMode('login')}
                onBack={() => setRegisterStep('role')}
              />
            )}
          </div>
        </div>
      )}
    </>
  );
}

export default AuthPage;
