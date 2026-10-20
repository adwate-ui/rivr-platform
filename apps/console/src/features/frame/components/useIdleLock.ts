import { useEffect } from 'react';

const IDLE_LIMIT = 10 * 60_000;
const CHECK_EVERY = 15_000;
// The last touch or key on a cage screen, kept in the browser so the lock holds across a reload.
const ACTIVE_AT_KEY = 'rivr-cage-active-at';
const ACTIVITY = ['pointerdown', 'keydown'] as const;

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
 * The cage locks after ten idle minutes (#384; .claude/rules/security.md): while a cage screen is open,
 * no touch or key for ten minutes calls onLock, which signs the cashier out. A cage screen opened (or
 * reloaded) more than ten minutes after the last activity locks at once. Leaving the cage screens ends it.
 */
export function useIdleLock(isCageScreen: boolean, onLock: () => void) {
  useEffect(() => {
    if (!isCageScreen) return undefined;
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
  }, [isCageScreen, onLock]);
}
