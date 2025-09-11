// src/main.tsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './app/App';
import { LangProvider } from './contexts/lang';
import './main.scss';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <LangProvider>
      <App />
    </LangProvider>
  </React.StrictMode>
);
