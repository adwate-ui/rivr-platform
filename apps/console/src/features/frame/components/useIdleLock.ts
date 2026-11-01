import { useEffect } from 'react';

const IDLE_LIMIT = 10 * 60_000;
const CHECK_EVERY = 15_000;
// The last touch, key or scroll on a screen that locks, kept in the browser so the lock holds across a reload.
const ACTIVE_AT_KEY = 'rivr-cage-active-at';
// Scrolling with the wheel to read a long record is work on it too (F1-36).
const ACTIVITY = ['pointerdown', 'keydown', 'wheel'] as const;

function readActiveAt(): number | null {
  try {
    const stored = globalThis.localStorage.getItem(ACTIVE_AT_KEY);
    return stored === null ? null : Number(stored);
  } catch {
    return null;
  }
}

function writeActiveAt(at: number | null): void {
  try {
    if (at === null) globalThis.localStorage.removeItem(ACTIVE_AT_KEY);
    else globalThis.localStorage.setItem(ACTIVE_AT_KEY, String(at));
  } catch {
    // Storage blocked: the lock still runs on this page's timer.
  }
}

/**
 * The cage, money, members' and venue-control screens lock after ten idle minutes (#384; .claude/rules/security.md):
 * while one is open, no touch, key or scroll of the wheel for ten minutes calls onLock, which signs the staff member out. One opened (or
 * reloaded) more than ten minutes after the last activity locks at once. Leaving those screens ends it.
 */
export function useIdleLock(locks: boolean, onLock: () => void) {
  useEffect(() => {
    if (!locks) return undefined;
    const stored = readActiveAt();
    if (stored !== null && Date.now() - stored > IDLE_LIMIT) {
      writeActiveAt(null);
      onLock();
      return undefined;
    }
    let activeAt = Date.now();
    // Another tab's activity counts too, through the stored time.
    const isIdle = () => Date.now() - Math.max(activeAt, readActiveAt() ?? 0) > IDLE_LIMIT;
    let isLocked = false;
    const lock = () => {
      if (isLocked) return;
      isLocked = true;
      globalThis.clearInterval(timer);
      writeActiveAt(null);
      onLock();
    };
    // A key after the limit (a computer woken from sleep, say) locks rather than counting as activity.
    const touch = () => {
      if (isIdle()) {
        lock();
        return;
      }
      activeAt = Date.now();
      writeActiveAt(activeAt);
    };
    const timer = globalThis.setInterval(() => {
      if (isIdle()) lock();
    }, CHECK_EVERY);
    touch();
    ACTIVITY.forEach((name) => globalThis.addEventListener(name, touch));
    return () => {
      ACTIVITY.forEach((name) => globalThis.removeEventListener(name, touch));
      globalThis.clearInterval(timer);
      writeActiveAt(null);
    };
  }, [locks, onLock]);
}
