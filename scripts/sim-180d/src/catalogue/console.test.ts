import { describe, expect, it } from 'vitest';
import { consoleScreens, loadConsoleMenu, readConsoleRoutes, screensFor } from './console.ts';

const menu = await loadConsoleMenu();
const screens = consoleScreens(menu, readConsoleRoutes());
const paths = (role: Parameters<typeof screensFor>[1]) => screensFor(screens, role).map((screen) => screen.path);

describe('consoleScreens', () => {
  it('lists each menu entry, and each tab of an entry with tabs', () => {
    expect(screens.find((screen) => screen.path === '/fnb')).toMatchObject({ kind: 'menu', anyOf: ['fnb.manage', 'fnb.serve'] });
    expect(screens.find((screen) => screen.path === '/waitlist?tab=lists')).toMatchObject({ kind: 'tab', anyOf: ['waitlist.manage'] });
    expect(screens.find((screen) => screen.path === '/settings?tab=devices')).toMatchObject({ kind: 'tab' });
    expect(screens.some((screen) => screen.path === '/requests')).toBe(true);
  });

  it('marks every HIDDEN address hidden', () => {
    for (const href of menu.hidden) expect(screens.find((screen) => screen.path === href)?.kind).toBe('hidden');
    expect(screens.find((screen) => screen.path === '/cage')?.kind).toBe('hidden');
  });

  it('lists addresses the router answers that the menu does not', () => {
    const routes = screens.filter((screen) => screen.kind === 'route').map((screen) => screen.path);
    expect(routes).toContain('/sign-in');
    expect(routes).toContain('/rake');
    expect(routes).not.toContain('/fnb');
  });

  it('lists each address once', () => {
    expect(new Set(screens.map((screen) => screen.path)).size).toBe(screens.length);
  });
});

describe('screensFor', () => {
  it('gives F&B staff the orders and nothing about members', () => {
    expect(paths('service')).toContain('/fnb');
    expect(paths('service')).not.toContain('/members');
    expect(paths('service')).not.toContain('/waitlist?tab=lists');
  });

  it('gives the floor the waitlist but not staff or tables', () => {
    expect(paths('floor')).toContain('/waitlist?tab=lists');
    expect(paths('floor')).not.toContain('/staff');
    expect(paths('floor')).not.toContain('/tables');
  });

  it('gives a super admin every menu screen and no hidden one', () => {
    const all = screens.filter((screen) => screen.kind === 'menu' || screen.kind === 'tab').length;
    expect(paths('super_admin')).toHaveLength(all);
    expect(paths('super_admin')).not.toContain('/cage');
  });

  it('gives a member and a device no console screen', () => {
    expect(paths('member')).toEqual([]);
    expect(paths('device')).toEqual([]);
  });
});
