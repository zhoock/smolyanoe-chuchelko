import { useState, FormEvent } from 'react';
import { login, isAuthenticated } from '@shared/lib/auth';
import './AuthForm.scss';

interface LoginFormProps {
  onSuccess?: () => void;
  onSwitchToRegister?: () => void;
}

export function LoginForm({ onSuccess, onSwitchToRegister }: LoginFormProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const result = await login(email, password);

      if (result.success) {
        if (onSuccess) {
          onSuccess();
        } else {
          // Перезагружаем страницу для обновления состояния
          window.location.reload();
        }
      } else {
        setError(result.error || 'Ошибка входа');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Неизвестная ошибка');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form className="auth-form" onSubmit={handleSubmit} method="post" autoComplete="on">
      <h2 className="auth-form__title">Вход</h2>

      {error && <div className="auth-form__error">{error}</div>}

      <div className="auth-form__field">
        <label htmlFor="login-email" className="auth-form__label">
          Email
        </label>
        <input
          id="login-email"
          name="email"
          type="email"
          className="auth-form__input"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          autoComplete="username"
          disabled={loading}
          data-form-type="username"
        />
      </div>

      <div className="auth-form__field">
        <label htmlFor="login-password" className="auth-form__label">
          Пароль
        </label>
        <input
          id="login-password"
          name="password"
          type="password"
          className="auth-form__input"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          autoComplete="current-password"
          disabled={loading}
          data-form-type="password"
        />
      </div>

      <button type="submit" className="auth-form__submit" disabled={loading}>
        {loading ? 'Вход...' : 'Войти'}
      </button>

      {onSwitchToRegister && (
        <div className="auth-form__switch">
          Нет аккаунта?{' '}
          <button type="button" className="auth-form__link" onClick={onSwitchToRegister}>
            Зарегистрироваться
          </button>
        </div>
      )}
    </form>
  );
}
