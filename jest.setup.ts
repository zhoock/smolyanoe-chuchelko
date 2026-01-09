/// <reference types="@testing-library/jest-dom" />
/// <reference types="@testing-library/jest-dom/jest-globals" />
import '@testing-library/jest-dom';

// Мокируем window.scrollTo, который не реализован в jsdom
Object.defineProperty(window, 'scrollTo', {
  value: jest.fn(),
  writable: true,
});

// По умолчанию эмулируем путь с username, чтобы thunk-и могли определить пользователя из URL
if (typeof window !== 'undefined' && window.history && window.location) {
  window.history.replaceState({}, '', '/testuser');
}

// Мокируем HTMLDialogElement.showModal, который не реализован в jsdom
if (typeof HTMLDialogElement !== 'undefined') {
  HTMLDialogElement.prototype.showModal = jest.fn(function (this: HTMLDialogElement) {
    this.setAttribute('open', '');
  });
  HTMLDialogElement.prototype.close = jest.fn(function (this: HTMLDialogElement) {
    this.removeAttribute('open');
  });
}
