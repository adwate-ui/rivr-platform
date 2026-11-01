import { describe, expect, it } from 'vitest';
import { scanResult } from './doorCopy.ts';

describe('what the door kiosk says (decision 0164)', () => {
  it('welcomes a member in, and says goodbye with the time they played', () => {
    expect(scanResult({ ok: true, value: { action: 'in', firstName: 'Kavya' } }))
      .toEqual({ title: 'Welcome, Kavya.', detail: 'You are checked in. Enjoy the game.', isRefused: false });
    expect(scanResult({ ok: true, value: { action: 'out', firstName: 'Mihir', playedSeconds: 16_200 } }))
      .toEqual({ title: 'Goodbye, Mihir.', detail: '4 h 30 min at the tables tonight. See you soon.', isRefused: false });
    expect(scanResult({ ok: true, value: { action: 'gone', firstName: 'Mihir', playedSeconds: 0 } }))
      .toEqual({ title: 'Goodbye, Mihir.', detail: 'Checked out. See you soon.', isRefused: false });
  });

  it('says why nothing happened', () => {
    expect(scanResult({ ok: false, error: { reason: 'call_time_owed', owedSeconds: 1_500 } }))
      .toEqual({ title: 'Not yet.', detail: '25 min of call time left. See the floor.', isRefused: true });
    expect(scanResult({ ok: false, error: { reason: 'seated', owedSeconds: 0 } }).detail).toBe('You are still seated. Leave your seat in the app, or ask the floor.');
    expect(scanResult({ ok: false, error: { reason: 'card_not_current', owedSeconds: 0 } }).title).toBe('Try again.');
    expect(scanResult({ ok: false, error: { reason: 'on_break', owedSeconds: 0 } }).detail).toBe('You are on a break from play.');
    expect(scanResult({ ok: false, error: { reason: 'not_allowed', owedSeconds: 0 } }).detail).toBe('This kiosk is no longer paired.');
    expect(scanResult({ ok: false, error: { reason: 'paused', owedSeconds: 0 } }))
      .toEqual({ title: 'See the front desk.', detail: 'Check-in is paused.', isRefused: true });
    expect(scanResult({ ok: false, error: { reason: 'stopped', owedSeconds: 0 } }).detail).toBe('Your membership is on hold.');
    expect(scanResult({ ok: false, error: { reason: 'unavailable', owedSeconds: 0 } }).detail).toBe('Card not read. Try again.');
  });
});
