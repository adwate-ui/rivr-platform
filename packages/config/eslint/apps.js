// @ts-check
/**
 * Apps assemble @rivr/ui; they never draw or style. Copy comes from @rivr/i18n.
 * See .claude/rules/ui.md and .claude/rules/apps.md.
 */
import i18next from 'eslint-plugin-i18next';
import react from 'eslint-plugin-react';
import { INTRINSIC_ELEMENTS } from './intrinsic-elements.js';

const UI_MESSAGE = 'Compose @rivr/ui (Box, Stack, Text, Button...). If something is missing, add it to @rivr/ui first.';

const STYLING_AND_VENDOR_IMPORTS = [
  { group: ['@radix-ui/*'], message: 'Radix is used only inside @rivr/ui.' },
  { group: ['tailwindcss', 'tailwindcss/*', '@tailwindcss/*', 'tailwind-merge'], message: 'Tailwind is used only inside @rivr/ui.' },
  { group: ['lucide-react', 'react-icons', 'react-icons/*', '@heroicons/*'], message: 'Use Icon from @rivr/ui.' },
  {
    group: ['styled-components', '@emotion/*', 'clsx', 'class-variance-authority'],
    message: 'Styling libraries are used only inside @rivr/ui.',
  },
  { group: ['@supabase/supabase-js', '@supabase/*'], message: 'Only @rivr/db talks to Supabase.' },
  { group: ['*.css', '!@rivr/ui/styles.css'], message: 'Apps import no stylesheet except @rivr/ui/styles.css.' },
];

/** Attributes whose text a member or staff user reads, so it must come from @rivr/i18n. */
const VISIBLE_ATTRIBUTES = [
  'label', 'title', 'placeholder', 'alt', 'aria-label', 'aria-description', 'aria-placeholder',
  'description', 'heading', 'message', 'caption', 'emptyText', 'errorText',
];

const literalStringRule = {
  plugins: { i18next },
  rules: {
    'i18next/no-literal-string': [
      'error',
      { mode: 'jsx-only', 'jsx-attributes': { include: VISIBLE_ATTRIBUTES } },
    ],
  },
};

/** @type {import('eslint').Linter.Config[]} */
export const appRules = [
  {
    files: ['apps/**/*.{ts,tsx}'],
    plugins: { react },
    settings: { react: { version: '19.3' } },
    rules: {
      'react/forbid-elements': [
        'error',
        { forbid: INTRINSIC_ELEMENTS.map((element) => ({ element, message: UI_MESSAGE })) },
      ],
      'react/forbid-component-props': ['error', { forbid: ['className', 'style'] }],
      'no-restricted-imports': ['error', { patterns: STYLING_AND_VENDOR_IMPORTS }],
    },
  },
  {
    files: ['apps/**/*.tsx', 'packages/ui/**/*.tsx'],
    ignores: ['**/*.test.tsx', '**/*.stories.tsx'],
    ...literalStringRule,
  },
];
