import { describe, expect, it } from 'vitest';
import { tableRetireRefusal } from './index.ts';

describe('taking a table away (decision 0432)', () => {
  it('may deactivate or delete a table nobody sits at or waits for', () => {
    expect(tableRetireRefusal({ seated: 0, waiting: 0 })).toBeNull();
  });

  it('refuses while a player sits at it, first of all', () => {
    expect(tableRetireRefusal({ seated: 1, waiting: 0 })).toBe('players_seated');
    expect(tableRetireRefusal({ seated: 9, waiting: 4 })).toBe('players_seated');
  });

  it('refuses while a place waits on its list', () => {
    expect(tableRetireRefusal({ seated: 0, waiting: 1 })).toBe('players_waiting');
  });
});
