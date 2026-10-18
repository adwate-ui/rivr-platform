// @ts-check
import { RuleTester } from 'eslint';
import { describe, it } from 'vitest';
import { todoNeedsIssue } from './todo-needs-issue.js';

RuleTester.describe = describe;
RuleTester.it = it;

new RuleTester().run('todo-needs-issue', todoNeedsIssue, {
  valid: [
    { code: '// TODO(#42): split this once lane B lands the table model' },
    { code: '/* FIXME https://github.com/adwate-ui/rivr-platform/issues/7 */' },
    { code: '// Rake rounds down to the nearest chip.' },
  ],
  invalid: [
    { code: '// TODO: handle the cap', errors: [{ messageId: 'missing', data: { marker: 'TODO' } }] },
    { code: '/* HACK until the printer arrives */', errors: [{ messageId: 'missing', data: { marker: 'HACK' } }] },
  ],
});
