import { defineConfig } from 'eslint/config';
import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import astro from 'eslint-plugin-astro';
import reactHooks from 'eslint-plugin-react-hooks';

export default defineConfig(
  { ignores: ['dist/', '.astro/', 'docs/explorations/', 'test-results/', 'playwright-report/'] },
  js.configs.recommended,
  tseslint.configs.strict,
  astro.configs['flat/recommended'],
  {
    files: ['**/*.{ts,tsx}'],
    ...reactHooks.configs.flat.recommended,
  },
  {
    // Node scripts: declared by hand instead of pulling the `globals` package for two names.
    files: ['scripts/**/*.mjs'],
    languageOptions: { globals: { console: 'readonly', process: 'readonly' } },
  },
  {
    rules: {
      // `any` is banned project-wide: use a real type or `unknown`.
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/consistent-type-imports': 'error',
    },
  },
);
