// src/shared/DataAwait.tsx
import { Suspense, ReactNode } from 'react';
import { Await } from 'react-router-dom';

type Props<T> = {
  value: Promise<T>;
  fallback?: ReactNode;
  error?: ReactNode;
  children: (data: T) => ReactNode;
};

export function DataAwait<T>({ value, fallback = null, error = null, children }: Props<T>) {
  return (
    <Suspense fallback={fallback}>
      <Await resolve={value} errorElement={error}>
        {children}
      </Await>
    </Suspense>
  );
}
