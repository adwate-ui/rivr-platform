import { describe, expect, it } from 'vitest';
import { memberColumns } from './memberColumns.tsx';

const mobileOf = (view: { seesPhone: boolean; exportsPhone: boolean }) =>
  memberColumns(new Map(), { ...view, choices: undefined, statuses: undefined }).find((column) => column.key === 'mobile');

describe('the mobile column (owner, 8 and 22 Nov)', () => {
  it('is shown to the floor and up, and exported by super admins alone', () => {
    expect(mobileOf({ seesPhone: false, exportsPhone: false })).toBeUndefined();
    expect(mobileOf({ seesPhone: true, exportsPhone: false })?.isExported).toBe(false);
    expect(mobileOf({ seesPhone: true, exportsPhone: true })?.isExported).not.toBe(false);
  });
});
