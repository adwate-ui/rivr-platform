import type { Sop, SopVersion } from '@rivr/db';
import { describe, expect, it } from 'vitest';
import { bodyLines, rolesText, sopFailureText, standingText, versionText, waitingText } from './sopCopy.ts';

const CURRENT: SopVersion = { versionId: 'v1', version: 2, owner: 'Duty manager', ackRoles: ['cashier'], effectiveOn: '2026-10-20', body: '1. Count.' };
const SOP: Sop = {
  sopId: 's1', title: 'Cage', current: CURRENT, next: null, mustAcknowledge: true, acknowledgedAt: null, acknowledgedCount: 1, requiredCount: 4,
};

describe('what the SOPs screen says', () => {
  it('gives the version in force and the one waiting, with their IST days', () => {
    expect(versionText(CURRENT)).toBe('Version 2, in force since 20 Oct 2026. Owner: Duty manager.');
    expect(waitingText({ ...CURRENT, version: 3, effectiveOn: '2026-11-01' })).toBe('Version 3 takes effect on 1 Nov 2026.');
  });

  it('names the roles that must acknowledge it, or none', () => {
    expect(rolesText(['dealer', 'host'])).toBe('To be acknowledged by Dealers and Hosts.');
    expect(rolesText([])).toBe('No role must acknowledge it.');
  });

  it('says whether the staff member has acknowledged, must, or need not', () => {
    expect(standingText(SOP)).toBe('Your role must acknowledge this version.');
    expect(standingText({ ...SOP, acknowledgedAt: '2026-10-20T18:45:00Z' })).toBe('You acknowledged this version on 21 Oct 2026.');
    expect(standingText({ ...SOP, mustAcknowledge: false })).toBeNull();
  });

  it('splits the text into its lines, and says why a step did not go through', () => {
    expect(bodyLines('1. Count.\n\n 2. Open. ')).toEqual(['1. Count.', '2. Open.']);
    expect(sopFailureText('taken')).toBe('The library already has an SOP with this title. Choose another title, or publish a new version of it.');
    expect(sopFailureText('changed')).toBe('A newer version is now in force. Read it, then acknowledge it.');
  });
});
