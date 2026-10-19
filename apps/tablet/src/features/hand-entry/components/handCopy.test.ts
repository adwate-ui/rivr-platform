import { describe, expect, it } from 'vitest';
import { variantOptions, variantText } from './handCopy.ts';

describe('what the hand entry screen says', () => {
  it('offers PLO and bomb pots only at a table that plays variations', () => {
    expect(variantOptions(true).map((option) => option.label)).toEqual(['Hold\'em', 'PLO', 'Bomb pot']);
    expect(variantOptions(false)).toEqual([{ value: 'holdem', label: 'Hold\'em' }]);
    expect(variantText('bomb_pot')).toBe('Bomb pot');
  });
});
