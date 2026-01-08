import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { isAuthenticated } from '@shared/lib/auth';
import { loadUserProfile } from '@entities/user/lib/loadUserProfile';
import { isAdmin } from '@shared/types/user';
import { isSubdomainMultiTenancyEnabled, redirectToSubdomain } from '@shared/lib/subdomain';
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
  const [searchParams] = useSearchParams();
  const { setLang } = useLang();

  // Получаем returnTo из query параметров
  const returnTo = searchParams.get('returnTo') || null;

  useEffect(() => {
    // Не делаем автоматический редирект, если показывается модалка выбора языка
    if (isAuthenticated() && !showLanguageModal) {
      // Если есть returnTo, перенаправляем туда, иначе в dashboard
      if (returnTo) {
        navigate(returnTo, { replace: true });
      } else {
        navigate('/dashboard', { replace: true });
      }
    }
  }, [navigate, showLanguageModal, returnTo]);

  // Если уже авторизован и модалка не показывается, ничего не рендерим
  if (isAuthenticated() && !showLanguageModal) {
    return null;
  }

  const handleSuccess = () => {
    // Показываем модалку выбора языка вместо прямого перехода
    setShowLanguageModal(true);
  };

  const handleRedirect = async () => {
    try {
      // Проверяем, является ли пользователь админом
      const userProfile = await loadUserProfile();
      const userIsAdmin = userProfile && isAdmin(userProfile);

      if (userIsAdmin) {
        // Админы остаются на главном домене
        const redirectPath = returnTo || '/dashboard';
        navigate(redirectPath, { replace: true });
      } else {
        // Для обычных пользователей в dev режиме редиректим на поддомен
        if (isSubdomainMultiTenancyEnabled()) {
          const { getUser } = await import('@shared/lib/auth');
          const user = getUser();
          if (user && user.email) {
            const subdomain = user.email.split('@')[0];
            if (subdomain) {
              redirectToSubdomain(subdomain, '/dashboard');
              return;
            }
          }
        }
        // Если поддомены не включены или не удалось определить поддомен
        const redirectPath = returnTo || '/dashboard';
        navigate(redirectPath, { replace: true });
      }
    } catch (error) {
      console.warn('⚠️ Failed to determine redirect path, using default:', error);
      const redirectPath = returnTo || '/dashboard';
      navigate(redirectPath, { replace: true });
    }
  };

  const handleLanguageSelected = (lang: 'ru' | 'en') => {
    setLang(lang);
    setShowLanguageModal(false);
    handleRedirect();
  };

  const handleCloseLanguageModal = () => {
    // При закрытии модалки используем текущий язык
    setShowLanguageModal(false);
    handleRedirect();
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
