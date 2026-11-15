import { describe, expect, it } from 'vitest';
import { reportTabFor } from './ReportsScreen.tsx';

describe('reportTabFor', () => {
  it('opens a report shown, Tables first, and never a hidden money report by its address (owner, 29 Oct and 8 Nov; redesign RD-27)', () => {
    for (const shown of ['tables', 'players', 'waitlist', 'fnb', 'bonus']) expect(reportTabFor(shown)).toBe(shown);
    expect(reportTabFor(undefined)).toBe('tables');
    for (const hidden of ['tonight', 'mis', 'unclaimed', 'growth', 'anything']) expect(reportTabFor(hidden)).toBe('tables');
  });
});
