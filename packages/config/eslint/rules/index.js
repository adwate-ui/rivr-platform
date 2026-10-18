// @ts-check
/** RIVR's local ESLint rules, registered under the `rivr/` prefix. */
import { todoNeedsIssue } from './todo-needs-issue.js';

/** @type {import('eslint').ESLint.Plugin} */
export const rivrPlugin = {
  meta: { name: 'rivr' },
  rules: { 'todo-needs-issue': todoNeedsIssue },
};
