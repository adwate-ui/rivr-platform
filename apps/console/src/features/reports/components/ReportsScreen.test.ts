import { describe, expect, it } from 'vitest';
import { reportTabFor } from './ReportsScreen.tsx';

describe('reportTabFor', () => {
  it('opens Tables, the one report shown, and never a hidden money report by its address (owner, 29 Oct and 8 Nov)', () => {
    expect(reportTabFor('tables')).toBe('tables');
    expect(reportTabFor(undefined)).toBe('tables');
    for (const hidden of ['tonight', 'mis', 'unclaimed', 'growth', 'anything']) expect(reportTabFor(hidden)).toBe('tables');
  });
});
