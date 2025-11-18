import { useState, FormEvent } from 'react';
import { register } from '@shared/lib/auth';
import './AuthForm.scss';

interface RegisterFormProps {
  onSuccess?: () => void;
  onSwitchToLogin?: () => void;
}

export function RegisterForm({ onSuccess, onSwitchToLogin }: RegisterFormProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);

    // Валидация
    if (password !== confirmPassword) {
      setError('Пароли не совпадают');
      return;
    }

    if (password.length < 6) {
      setError('Пароль должен содержать минимум 6 символов');
      return;
    }

    setLoading(true);

    try {
      const result = await register(email, password, name || undefined);

      if (result.success) {
        if (onSuccess) {
          onSuccess();
        } else {
          // Перезагружаем страницу для обновления состояния
          window.location.reload();
        }
      } else {
        setError(result.error || 'Ошибка регистрации');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Неизвестная ошибка');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form className="auth-form" onSubmit={handleSubmit}>
      <h2 className="auth-form__title">Регистрация</h2>

      {error && <div className="auth-form__error">{error}</div>}

      <div className="auth-form__field">
        <label htmlFor="register-name" className="auth-form__label">
          Имя (необязательно)
        </label>
        <input
          id="register-name"
          type="text"
          className="auth-form__input"
          value={name}
          onChange={(e) => setName(e.target.value)}
          autoComplete="name"
          disabled={loading}
        />
      </div>

      <div className="auth-form__field">
        <label htmlFor="register-email" className="auth-form__label">
          Email
        </label>
        <input
          id="register-email"
          type="email"
          className="auth-form__input"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          autoComplete="email"
          disabled={loading}
        />
      </div>

      <div className="auth-form__field">
        <label htmlFor="register-password" className="auth-form__label">
          Пароль
        </label>
        <input
          id="register-password"
          type="password"
          className="auth-form__input"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          autoComplete="new-password"
          minLength={6}
          disabled={loading}
        />
      </div>

      <div className="auth-form__field">
        <label htmlFor="register-confirm-password" className="auth-form__label">
          Подтвердите пароль
        </label>
        <input
          id="register-confirm-password"
          type="password"
          className="auth-form__input"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          required
          autoComplete="new-password"
          minLength={6}
          disabled={loading}
        />
      </div>

      <button type="submit" className="auth-form__submit" disabled={loading}>
        {loading ? 'Регистрация...' : 'Зарегистрироваться'}
      </button>

      {onSwitchToLogin && (
        <div className="auth-form__switch">
          Уже есть аккаунт?{' '}
          <button type="button" className="auth-form__link" onClick={onSwitchToLogin}>
            Войти
          </button>
        </div>
      )}
    </form>
  );
}
