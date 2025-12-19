import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { isAuthenticated } from '@shared/lib/auth';
import { useLang } from '@app/providers/lang';
import { LoginForm } from './LoginForm';
import { RegisterForm } from './RegisterForm';
import { LanguageSelectModal } from './LanguageSelectModal';
import './AuthPage.scss';

type AuthMode = 'login' | 'register';

export function AuthPage() {
  const [mode, setMode] = useState<AuthMode>('login');
  const [showLanguageModal, setShowLanguageModal] = useState(false);
  const navigate = useNavigate();
  const { setLang } = useLang();

  useEffect(() => {
    // Не делаем автоматический редирект, если показывается модалка выбора языка
    if (isAuthenticated() && !showLanguageModal) {
      navigate('/dashboard-new', { replace: true });
    }
  }, [navigate, showLanguageModal]);

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
    navigate('/dashboard-new');
  };

  const handleCloseLanguageModal = () => {
    // При закрытии модалки используем текущий язык и переходим в dashboard
    setShowLanguageModal(false);
    navigate('/dashboard-new');
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
