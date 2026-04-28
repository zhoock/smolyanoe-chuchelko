import { useState, useEffect, useMemo } from 'react';
import { useNavigate, useSearchParams, useLocation } from 'react-router-dom';
import { isAuthenticated } from '@shared/lib/auth';
import { resolvePostAuthDestination } from '@shared/lib/authReturnUrl';
import { useLang } from '@app/providers/lang';
import { LoginForm } from './LoginForm';
import { RegisterForm } from './RegisterForm';
import { LanguageSelectModal } from './LanguageSelectModal';
import './AuthPage.scss';

type AuthMode = 'login' | 'register';

export function AuthPage() {
  const [searchParams] = useSearchParams();
  const location = useLocation();
  const [mode, setMode] = useState<AuthMode>(() =>
    searchParams.get('mode') === 'register' ? 'register' : 'login'
  );
  const [showLanguageModal, setShowLanguageModal] = useState(false);
  const navigate = useNavigate();
  const { setLang } = useLang();

  const postAuthPath = useMemo(
    () =>
      resolvePostAuthDestination({
        returnToSearchParam: searchParams.get('returnTo'),
        routerState: location.state,
      }),
    [searchParams, location.state]
  );

  useEffect(() => {
    const m = searchParams.get('mode');
    if (m === 'register') setMode('register');
    else if (m === 'login') setMode('login');
  }, [searchParams]);

  useEffect(() => {
    // Не делаем автоматический редирект, если показывается модалка выбора языка
    if (isAuthenticated() && !showLanguageModal) {
      navigate(postAuthPath, { replace: true });
    }
  }, [navigate, showLanguageModal, postAuthPath]);

  // Если уже авторизован и модалка не показывается, ничего не рендерим
  if (isAuthenticated() && !showLanguageModal) {
    return null;
  }

  const handleSuccess = () => {
    // Показываем модалку выбора языка вместо прямого перехода
    setShowLanguageModal(true);
  };

  const handleLanguageSelected = (lang: 'ru' | 'en') => {
    setLang(lang);
    setShowLanguageModal(false);
    navigate(postAuthPath);
  };

  const handleCloseLanguageModal = () => {
    setShowLanguageModal(false);
    navigate(postAuthPath);
  };

  return (
    <>
      {/* Показываем форму авторизации только если модалка выбора языка не открыта */}
      {!showLanguageModal && (
        <div className="auth-page">
          <div className="auth-page__backdrop" />
          <div className="auth-page__container">
            <button
              type="button"
              className="auth-page__close"
              aria-label="Закрыть"
              onClick={() => navigate(-1)}
            >
              ×
            </button>
            {mode === 'login' ? (
              <LoginForm onSuccess={handleSuccess} onSwitchToRegister={() => setMode('register')} />
            ) : (
              <RegisterForm onSuccess={handleSuccess} onSwitchToLogin={() => setMode('login')} />
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
