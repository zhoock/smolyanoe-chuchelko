// src/index.tsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './app/App';
import { StoreProvider } from '@app/providers/StoreProvider';
import { LangProvider } from '@app/providers/lang';
import { HelmetProvider } from 'react-helmet-async';
import { CartProvider } from '@entities/service/model/CartContext';
import './main.scss';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <HelmetProvider>
      <StoreProvider>
        <LangProvider>
          <CartProvider>
            <App />
          </CartProvider>
        </LangProvider>
      </StoreProvider>
    </HelmetProvider>
  </React.StrictMode>
);
