import { describe, expect, it } from 'vitest';
import { fromWire, toWire, viewKey, type TableView } from './tableView.ts';

const OWN = { key: 'name', direction: 'ascending' } as const;
const VIEW: TableView = {
  sort: { key: 'visits', direction: 'descending' },
  query: '9000',
  filters: {
    tier: { kind: 'choice', chosen: ['Member', 'Founders'] },
    played: { kind: 'range', min: '2', max: '' },
    joined: { kind: 'date', preset: 'last7' },
    at: { kind: 'dateRange', from: '2026-11-02', to: '' },
    name: { kind: 'text', typed: 'ravi' },
    city: { kind: 'text', typed: '  ' },
  },
};

describe('table views in the address', () => {
  it('keys a table by its name', () => {
    expect(viewKey('Members')).toBe('t.members');
    expect(viewKey('Open markers, tonight')).toBe('t.open-markers-tonight');
  });

  it('keeps only what differs from the table, and reads it back the same', () => {
    const wire = toWire(VIEW, OWN);
    expect(wire).toEqual({
      s: '-visits', q: '9000',
      f: { tier: ['c', 'Member', 'Founders'], played: ['r', '2', ''], joined: ['p', 'last7'], at: ['d', '2026-11-02', ''], name: ['t', 'ravi'] },
    });
    const { city: _city, ...asked } = VIEW.filters;
    expect(fromWire(JSON.parse(JSON.stringify(wire)), OWN)).toEqual({ ...VIEW, filters: asked });
  });

  it('keeps nothing for the table as it is, and none for an order taken off', () => {
    expect(toWire({ sort: OWN, query: ' ', filters: {} }, OWN)).toBeUndefined();
    expect(toWire({ sort: null, query: '', filters: {} }, OWN)).toEqual({ s: '' });
    expect(fromWire({ s: '' }, OWN).sort).toBeNull();
  });

  it('reads a wrong or hostile link as the table as it is, cut to size', () => {
    expect(fromWire('nonsense', OWN)).toEqual({ sort: OWN, query: '', filters: {} });
    const view = fromWire({ q: 'x'.repeat(500), f: { a: ['p', 'someday'], b: ['d', 'yesterday', '2026-11-08'], c: ['c', ...Array.from({ length: 80 }, (_, at) => String(at))], d: 5, e: ['z'] } }, null);
    expect(view.query).toHaveLength(200);
    expect(view.filters).toEqual({ b: { kind: 'dateRange', from: '', to: '2026-11-08' }, c: { kind: 'choice', chosen: Array.from({ length: 50 }, (_, at) => String(at)) } });
  });
});
