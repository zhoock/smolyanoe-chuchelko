import React from "react";

interface ErrorMessageProps {
  error: string;
}

export function ErrorMessage({ error }: ErrorMessageProps) {
  return <h3 className="error">{error}</h3>;
}
