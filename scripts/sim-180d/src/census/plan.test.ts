import { describe, expect, it } from 'vitest';
import type { Screen } from '../catalogue/types.ts';
import { expectFor, fillPath, mayOpen, planVisits, roleOf, type Person } from './plan.ts';

const screen = (overrides: Partial<Screen>): Screen => ({ app: 'console', path: '/members', kind: 'menu', anyOf: ['members.manage'], source: 'x', ...overrides });

describe('mayOpen', () => {
  it('lets a role open a screen it holds a permission for, and any staff a screen that names none', () => {
    expect(mayOpen('super_admin', screen({}))).toBe(true);
    expect(mayOpen('service', screen({}))).toBe(false);
    expect(mayOpen('service', screen({ path: '/fnb', anyOf: ['fnb.manage', 'fnb.serve'] }))).toBe(true);
    expect(mayOpen('dealer', screen({ path: '/settings', anyOf: [] }))).toBe(true);
  });
});

describe('expectFor', () => {
  it('expects a refusal where the role lacks the permission', () => {
    expect(expectFor('service', screen({}))).toBe('refused');
    expect(expectFor('admin', screen({}))).toBe('open');
  });

  it('expects hidden screens and old addresses to move everyone on', () => {
    expect(expectFor('super_admin', screen({ path: '/cage', kind: 'hidden', anyOf: [] }))).toBe('moved');
    expect(expectFor('admin', screen({ path: '/tvs', kind: 'route', anyOf: [] }))).toBe('moved');
    expect(expectFor('member_seated', screen({ app: 'player', path: '/balance', kind: 'hidden', anyOf: [] }))).toBe('moved');
  });

  it('asks a signed-out visitor to sign in, except on the sign-in and sign-up screens', () => {
    expect(expectFor('visitor', screen({ app: 'player', path: '/rewards', anyOf: [] }))).toBe('sign_in');
    expect(expectFor('visitor', screen({ app: 'player', path: '/sign-up', kind: 'route', anyOf: [] }))).toBe('open');
    expect(expectFor('member_seated', screen({ app: 'player', path: '/sign-in', kind: 'route', anyOf: [] }))).toBe('moved');
  });

  it('opens the website for a visitor and a device its own screen', () => {
    expect(expectFor('visitor', screen({ app: 'web', path: '/', kind: 'route', anyOf: [] }))).toBe('open');
    expect(expectFor('tv', screen({ app: 'display', path: '/#waitlist', anyOf: [] }))).toBe('open');
  });
});

describe('roleOf', () => {
  it('gives staff their role, members and devices one role each', () => {
    const people: Person[] = ['floor', 'member_waiting', 'tv', 'visitor'];
    expect(people.map(roleOf)).toEqual(['floor', 'member', 'device', 'visitor']);
  });
});

describe('fillPath', () => {
  it('fills parameters, and gives null for one it has no value for', () => {
    expect(fillPath('/sessions/$sessionId', { sessionId: 's1' })).toBe('/sessions/s1');
    expect(fillPath('/preview/$token', {})).toBeNull();
    expect(fillPath('/rewards', {})).toBe('/rewards');
  });
});

describe('planVisits', () => {
  const screens: Screen[] = [
    screen({}),
    screen({ app: 'player', path: '/sessions/$sessionId', anyOf: [] }),
    screen({ app: 'web', path: '/preview/$token', kind: 'route', anyOf: [] }),
  ];

  it('visits every console screen as every staff role', () => {
    const { visits } = planVisits(screens, 'console', {});
    expect(visits).toHaveLength(9);
    expect(visits.find((visit) => visit.person === 'owner_view')?.expect).toBe('refused');
  });

  it('visits player screens as the three members and the visitor, with parameters filled', () => {
    const { visits } = planVisits(screens, 'player', { sessionId: 's1' });
    expect(visits.map((visit) => visit.person)).toEqual(['member_seated', 'member_waiting', 'member_browsing', 'member_unchecked', 'visitor']);
    expect(visits[0]?.path).toBe('/sessions/s1');
  });

  it('skips an address it cannot fill', () => {
    expect(planVisits(screens, 'web', {})).toEqual({ visits: [], skipped: ['/preview/$token'] });
  });
});
