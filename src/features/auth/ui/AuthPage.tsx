import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { isAuthenticated } from '@shared/lib/auth';
import { LoginForm } from './LoginForm';
import { RegisterForm } from './RegisterForm';
import './AuthPage.scss';

type AuthMode = 'login' | 'register';

export function AuthPage() {
  const [mode, setMode] = useState<AuthMode>('login');
  const navigate = useNavigate();

  // Если уже авторизован, перенаправляем в dashboard
  if (isAuthenticated()) {
    navigate('/dashboard/albums');
    return null;
  }

  const handleSuccess = () => {
    navigate('/dashboard/albums');
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
