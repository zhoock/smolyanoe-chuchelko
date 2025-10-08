// src/index.tsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './app/App';
import { LangProvider } from './contexts/lang';
import { HelmetProvider } from 'react-helmet-async';
import './main.scss';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <HelmetProvider>
      <LangProvider>
        <App />
      </LangProvider>
    </HelmetProvider>
  </React.StrictMode>
);
