import { memberIdSchema } from '@rivr/contracts';
import { describe, expect, it } from 'vitest';
import { newId, nextTestUuid } from './ids.ts';

describe('test ids', () => {
  it('makes a different valid uuid every time', () => {
    const first = nextTestUuid();
    const second = nextTestUuid();

    expect(first).not.toBe(second);
    expect(memberIdSchema.safeParse(first).success).toBe(true);
    expect(first).toMatch(/^7e570000-0000-4000-8000-[0-9a-f]{12}$/);
  });

  it('makes a branded id of every kind', () => {
    const ids = [
      newId.venue(),
      newId.member(),
      newId.staff(),
      newId.device(),
      newId.table(),
      newId.ledgerAccount(),
      newId.ledgerTransaction(),
      newId.idempotencyKey(),
    ];

    expect(new Set(ids).size).toBe(ids.length);
  });
});
