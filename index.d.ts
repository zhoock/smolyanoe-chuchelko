declare module '*.jpg';
declare module '*.png';
declare module '*.webp';
declare module '*.svg';

// Типы для CSS/SCSS модулей
declare module '*.module.css' {
  const classes: { [key: string]: string };
  export default classes;
}

declare module '*.module.scss' {
  const classes: { [key: string]: string };
  export default classes;
}

declare module '*.module.sass' {
  const classes: { [key: string]: string };
  export default classes;
}

/// <reference types="@testing-library/jest-dom" />
