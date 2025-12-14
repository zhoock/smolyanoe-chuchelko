import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { isAuthenticated } from '@shared/lib/auth';
import { LoginForm } from './LoginForm';
import { RegisterForm } from './RegisterForm';
import './AuthPage.scss';

type AuthMode = 'login' | 'register';

export function AuthPage() {
  const [mode, setMode] = useState<AuthMode>('login');
  const navigate = useNavigate();

  useEffect(() => {
    if (isAuthenticated()) {
      navigate('/dashboard-new', { replace: true });
    }
  }, [navigate]);

  // Если уже авторизован, ничего не рендерим (редирект произойдёт через useEffect)
  if (isAuthenticated()) {
    return null;
  }

  const handleSuccess = () => {
    navigate('/dashboard-new');
  };

  return (
    <div className="auth-page main-background">
      <div className="auth-page__container">
        {mode === 'login' ? (
          <LoginForm onSuccess={handleSuccess} onSwitchToRegister={() => setMode('register')} />
        ) : (
          <RegisterForm onSuccess={handleSuccess} onSwitchToLogin={() => setMode('login')} />
        )}
      </div>
    </div>
  );
}

export default AuthPage;
