import pluginReactConfig from 'eslint-plugin-react/configs/recommended.js'
import path from 'path'
import { fileURLToPath } from 'url'
import { FlatCompat } from '@eslint/eslintrc'
import pluginJs from '@eslint/js'

const filename = fileURLToPath(import.meta.url)
const dirname = path.dirname(filename)

const compat = new FlatCompat({
  baseDirectory: dirname,
  recommendedConfig: pluginJs.configs.recommended
})

export default [
  {
    languageOptions: {
      parserOptions: {
        project: './tsconfig.eslint.json'
      }
    },
    settings: {
      react: {
        version: 'detect'
      }
    }
  },
  ...compat.extends('standard-with-typescript'),
  pluginReactConfig
]
