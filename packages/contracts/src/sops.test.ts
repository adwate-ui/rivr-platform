import { describe, expect, it } from 'vitest';
import { sopSchema, sopVersionSchema } from './sops.ts';

const VERSION = { owner: ' Floor manager ', ackRoles: ['dealer', 'host'], effectiveOn: '2026-11-01', body: '1. Sign in.' };

describe('SOPs', () => {
  it('takes a version with its owner, roles, day and text, trimmed', () => {
    expect(sopVersionSchema.parse(VERSION)).toEqual({ ...VERSION, owner: 'Floor manager' });
    expect(sopVersionSchema.safeParse({ ...VERSION, ackRoles: [] }).success).toBe(true);
  });

  it('refuses a blank owner or text, a role that does not exist, or a day that is not a date', () => {
    expect(sopVersionSchema.safeParse({ ...VERSION, owner: '  ' }).success).toBe(false);
    expect(sopVersionSchema.safeParse({ ...VERSION, body: '' }).success).toBe(false);
    expect(sopVersionSchema.safeParse({ ...VERSION, ackRoles: ['croupier'] }).success).toBe(false);
    expect(sopVersionSchema.safeParse({ ...VERSION, effectiveOn: '1 Nov' }).success).toBe(false);
  });

  it('takes a new SOP with its title', () => {
    expect(sopSchema.safeParse({ ...VERSION, title: 'Opening the room' }).success).toBe(true);
    expect(sopSchema.safeParse({ ...VERSION, title: '' }).success).toBe(false);
  });
});
