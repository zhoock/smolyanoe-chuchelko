// src/shared/ui/error-boundary/ErrorFallback.tsx
import './style.scss';

interface ErrorFallbackProps {
  error: Error | null;
  onReset: () => void;
}

/**
 * Компонент для отображения ошибки с возможностью перезагрузки.
 */
export function ErrorFallback({ error, onReset }: ErrorFallbackProps) {
  return (
    <div className="error-boundary" role="alert">
      <div className="error-boundary__content">
        <h2 className="error-boundary__title">
          {process.env.NODE_ENV === 'development' ? 'Что-то пошло не так' : 'Произошла ошибка'}
        </h2>
        {process.env.NODE_ENV === 'development' && error && (
          <details className="error-boundary__details">
            <summary className="error-boundary__summary">Детали ошибки</summary>
            <pre className="error-boundary__pre">{error.toString()}</pre>
            {error.stack && (
              <pre className="error-boundary__pre error-boundary__stack">{error.stack}</pre>
            )}
          </details>
        )}
        <div className="error-boundary__actions">
          <button
            type="button"
            onClick={onReset}
            className="error-boundary__button"
            aria-label="Попробовать снова"
          >
            Попробовать снова
          </button>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="error-boundary__button error-boundary__button--secondary"
            aria-label="Перезагрузить страницу"
          >
            Перезагрузить страницу
          </button>
        </div>
      </div>
    </div>
  );
}
