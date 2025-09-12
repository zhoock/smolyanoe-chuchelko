// eslint.config.mjs

import js from '@eslint/js';
import tsPlugin from '@typescript-eslint/eslint-plugin';
import tsParser from '@typescript-eslint/parser';
import reactPlugin from 'eslint-plugin-react';
import reactHooksPlugin from 'eslint-plugin-react-hooks';
import importPlugin from 'eslint-plugin-import';
import jsxA11yPlugin from 'eslint-plugin-jsx-a11y';
import eslintCommentsPlugin from 'eslint-plugin-eslint-comments';

const browserGlobals = {
  window: 'readonly',
  document: 'readonly',
  console: 'readonly',
  localStorage: 'readonly',
  HTMLElement: 'readonly',
  HTMLDivElement: 'readonly',
  HTMLAudioElement: 'readonly',
  HTMLInputElement: 'readonly',
  HTMLImageElement: 'readonly',
  HTMLDialogElement: 'readonly',
  MouseEvent: 'readonly',
  Node: 'readonly',
  screen: 'readonly',
};

export default [
  js.configs.recommended,

  // --- приложение (src) ---
  {
    files: ['src/**/*.{js,jsx,ts,tsx}'],
    languageOptions: {
      parser: tsParser,
      parserOptions: { ecmaVersion: 2020, sourceType: 'module' },
      globals: browserGlobals,
    },
    plugins: {
      '@typescript-eslint': tsPlugin,
      react: reactPlugin,
      'react-hooks': reactHooksPlugin,
      import: importPlugin,
      'jsx-a11y': jsxA11yPlugin,
      'eslint-comments': eslintCommentsPlugin,
    },
    settings: {
      react: { version: 'detect' },
      'import/resolver': {
        typescript: { project: './tsconfig.json' },
        node: { extensions: ['.js', '.jsx', '.ts', '.tsx'] },
      },
    },
    rules: {
      quotes: ['error', 'single', { avoidEscape: true }],
      semi: ['error', 'always'],

      // типскриптовые и общие послабления
      'no-unused-vars': 'off',
      '@typescript-eslint/no-unused-vars': 'off',
      '@typescript-eslint/explicit-module-boundary-types': 'off',
      '@typescript-eslint/no-require-imports': 'off',
      'react/prop-types': 'off',
      'react/jsx-uses-react': 'off',
      'react/react-in-jsx-scope': 'off',
      'no-undef': 'off',

      // реактовые хуки — ТУТ (где плагин подключён)
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
    },
  },

  // --- конфиги/скрипты ноды (webpack, postcss) ---
  {
    files: ['webpack/**/*.js', 'postcss.config.js'],
    languageOptions: {
      parserOptions: { project: null },
      globals: { require: 'readonly', module: 'readonly', __dirname: 'readonly' },
    },
    rules: {
      // без react-hooks здесь — он не нужен для конфигов
      'no-undef': 'off',
      '@typescript-eslint/no-require-imports': 'off',
    },
  },

  // --- игноры ---
  {
    ignores: [
      'node_modules/**',
      'dist/**',
      'build/**',
      'storybook-static/**',
      'coverage/**',
      '*.d.ts',
      'commitlint.config.js',
      'webpack.config.js',
      // 'webpack/**/*.js', // уже описано выше в файлах
      'postcss.config.js',
      'babel.config.js',
      'jest.config.js',
    ],
  },
];
