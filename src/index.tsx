import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './components/App';
import './utils/i18n';
import './main.scss';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
