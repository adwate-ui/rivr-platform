// @ts-check
/**
 * RIVR ESLint flat config. Every rule is an error; warnings are not used.
 * The rule list comes from "ESLint rules Lane 0 must configure" in docs/engineering/stack.md.
 */
import js from '@eslint/js';
import { defineConfig } from 'eslint/config';
import reactHooks from 'eslint-plugin-react-hooks';
import globals from 'globals';
import tseslint from 'typescript-eslint';
import { appRules } from './apps.js';
import { designValueRules } from './design-values.js';
import { rivrPlugin } from './rules/index.js';

const IGNORES = [
  '**/node_modules/**',
  '**/dist/**',
  '**/storybook-static/**',
  '**/.turbo/**',
  '**/coverage/**',
  '**/.astro/**',
  '**/.wrangler/**',
  '**/.stryker-tmp/**',
  'reports/**',
  'test-results/**',
  'playwright-report/**',
  'apps/*/android/**',
  'supabase/.temp/**',
  // Generated files: edit the source (tokens.json, the migrations) and regenerate.
  'packages/tokens/generated/**',
  // Where the tokens build writes before it moves into generated/: lint, run beside it, must not walk it.
  '**/generated.next/**',
  'packages/db/src/database.types.ts',
];

const sizeAndClarity = {
  complexity: ['error', 10],
  'max-depth': ['error', 3],
  'max-params': ['error', 4],
  'max-lines': ['error', { max: 250, skipBlankLines: true, skipComments: true }],
  'max-lines-per-function': ['error', { max: 40, skipBlankLines: true, skipComments: true }],
  'no-console': 'error',
  'rivr/todo-needs-issue': 'error',
};

const typeSafety = {
  '@typescript-eslint/no-explicit-any': 'error',
  '@typescript-eslint/no-non-null-assertion': 'error',
  '@typescript-eslint/consistent-type-assertions': ['error', { assertionStyle: 'never' }],
  '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
};

export default defineConfig(
  { ignores: IGNORES },
  js.configs.recommended,
  tseslint.configs.recommended,
  {
    languageOptions: { globals: { ...globals.browser, ...globals.node } },
    linterOptions: { reportUnusedDisableDirectives: 'error' },
    plugins: { rivr: rivrPlugin },
    rules: { ...sizeAndClarity, ...typeSafety },
  },
  {
    files: ['**/*.tsx'],
    plugins: { 'react-hooks': reactHooks },
    rules: reactHooks.configs['recommended-latest'].rules,
  },
  {
    // Edge Functions run on Deno.
    files: ['supabase/functions/**/*.ts'],
    languageOptions: { globals: { Deno: 'readonly' } },
  },
  {
    // k6 load tests run in k6's runtime, which provides these.
    files: ['load/k6/**/*.js'],
    languageOptions: { globals: { __ENV: 'readonly', __VU: 'readonly', __ITER: 'readonly' } },
  },
  {
    // Type assertions are allowed only where external data is parsed.
    files: ['**/parse/**'],
    rules: { '@typescript-eslint/consistent-type-assertions': 'off' },
  },
  {
    // describe() and it() callbacks are functions, so a per-function length limit
    // would cap test suites rather than functions. docs/decisions/0006.
    files: ['**/*.test.{ts,tsx,js}', '**/*.spec.ts', 'e2e/**'],
    rules: { 'max-lines-per-function': 'off' },
  },
  designValueRules,
  appRules,
);
