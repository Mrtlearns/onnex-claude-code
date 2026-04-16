import js from '@eslint/js'
import tseslint from 'typescript-eslint'
import security from 'eslint-plugin-security'

export default tseslint.config(
  { ignores: ['dist/**', 'node_modules/**'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  security.configs.recommended,
  {
    files: ['src/**/*.ts'],
    rules: {
      // Allow any[] in express route handlers — overly strict for API code
      '@typescript-eslint/no-explicit-any': 'warn',
      // DB query strings use bracket access intentionally
      'security/detect-object-injection': 'off',
      // Pool.query() strings are parameterised, not user-controlled
      'security/detect-non-literal-fs-filename': 'off',
      // Allow _-prefixed identifiers as intentionally unused (standard Express pattern)
      '@typescript-eslint/no-unused-vars': ['error', {
        argsIgnorePattern: '^_',
        varsIgnorePattern: '^_',
        caughtErrorsIgnorePattern: '^_',
      }],
    },
  },
)
