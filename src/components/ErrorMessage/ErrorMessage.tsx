// src/components/ErrorMessage/ErrorMessage.tsx

interface ErrorMessageProps {
  error: string;
}

export function ErrorMessage({ error }: ErrorMessageProps) {
  return <h3 className="error">{error}</h3>;
}
