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
    settings: { react: { version: 'detect' } },
    rules: {
      quotes: ['error', 'single', { avoidEscape: true }],
      semi: ['error', 'always'],

      // 🔥 убираем предупреждения
      'no-unused-vars': 'off',
      '@typescript-eslint/no-unused-vars': 'off',

      '@typescript-eslint/no-require-imports': 'off',
      'react/prop-types': 'off',
      'react/jsx-uses-react': 'off',
      'react/react-in-jsx-scope': 'off',
      'no-undef': 'off',
      '@typescript-eslint/explicit-module-boundary-types': 'off',
    },
  },

  {
    files: ['webpack/**/*.js', 'postcss.config.js'],
    languageOptions: {
      parserOptions: { project: null },
      globals: { require: 'readonly', module: 'readonly', __dirname: 'readonly' },
    },
    rules: {
      'no-undef': 'off',
      '@typescript-eslint/no-require-imports': 'off',
    },
  },

  {
    ignores: ['node_modules/**', 'dist/**', 'build/**', '**/*.d.ts', 'storybook-static/**'],
  },
];
// eslint.config.mjs
