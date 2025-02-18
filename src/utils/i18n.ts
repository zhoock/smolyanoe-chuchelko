import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
// import ru from '../assets/albums-ru.json';
// import en from '../assets/albums-en.json';

i18n.use(initReactI18next).init({
  //   resources: {
  //     ru: { translation: ru },
  //     en: { translation: en },
  //   },
  resources: {
    ru: {
      translation: {
        welcomeMessage: 'Добро пожаловать в React и react-i18next',
      },
    },
    en: {
      translation: {
        welcomeMessage: 'Welcome to React and react-i18next',
      },
    },
  },
  lng: 'ru', // Язык по умолчанию
  fallbackLng: 'en', // Резервный язык
  interpolation: { escapeValue: false }, // Отключаем экранирование
});

export default i18n;
