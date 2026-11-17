import { Capacitor } from '@capacitor/core';
import { useSyncExternalStore } from 'react';

/** Chromium's install prompt, which TypeScript's DOM types do not describe. */
interface InstallPromptEvent extends Event {
  prompt: () => Promise<unknown>;
}

const VISITS = 'rivr-visits';
// Before #1054 one Not now put the offer away for good; a member who said it is offered it again, from their next visit.
const DISMISSED = 'rivr-install-dismissed';
// How often Not now was pressed, at which visit and when, as JSON: `{ times, visit, at }`.
const SNOOZED = 'rivr-install-snoozed';
// Set once the browser says the app was installed: a browser tab of an installed app never offers it again.
const INSTALLED = 'rivr-installed';
// Set for the life of the tab or installed app: a reload, an update or the return from DigiLocker
// is the same visit, not a second one.
const COUNTED = 'rivr-visit-counted';
// When the app last went out of sight, kept across a tab the phone restores (with its session) or an app it reopens.
const HIDDEN_AT = 'rivr-hidden-at';
// A phone keeps a tab or an installed app open for days, so coming back to it after 30 minutes away is a visit too.
const AWAY_MS = 30 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;
// After the second Not now the offer waits this many days, then longer each time (the owner, 17 Nov).
const LATER_DAYS = [1, 3, 7, 30] as const;

let deferredPrompt: InstallPromptEvent | null = null;
const listeners = new Set<() => void>();

function changed() {
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

// Storage can be off (private browsing); the offer then shows each visit, as nothing says it was put away.
function read(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function write(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Nothing to keep it in: the offer may show again next time.
  }
}

function isInstallPrompt(event: Event): event is InstallPromptEvent {
  return typeof Reflect.get(event, 'prompt') === 'function';
}

const readVisits = () => Number(read(VISITS) ?? '0');

function addVisit() {
  write(VISITS, String(readVisits() + 1));
  changed();
}

/** Whether the app comes back after 30 minutes or more out of sight; then forgets when it went. */
function isBackAfterAWhile(): boolean {
  const hiddenAt = Number(read(HIDDEN_AT));
  write(HIDDEN_AT, '');
  return hiddenAt > 0 && Date.now() - hiddenAt >= AWAY_MS;
}

/**
 * Counts this opening of the app as a visit, once however often the page loads in it; and a tab the phone restores with
 * its session, after 30 minutes or more out of sight, as one too.
 */
function countVisit() {
  let isNewSession: boolean;
  try {
    isNewSession = sessionStorage.getItem(COUNTED) !== '1';
    sessionStorage.setItem(COUNTED, '1');
  } catch {
    return;
  }
  if (isBackAfterAWhile() || isNewSession) addVisit();
}

/** Counts a return to the app after 30 minutes or more out of sight as a visit too. */
function countReturns() {
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') write(HIDDEN_AT, String(Date.now()));
    else if (isBackAfterAWhile()) addVisit();
  });
}

/**
 * Counts this opening of the app, and each return to it after a while away, and keeps the browser's install prompt for
 * later: it fires once, often before the screen that offers it has drawn. Called once, at start (main.tsx).
 */
export function startInstallWatch() {
  countVisit();
  countReturns();
  window.addEventListener('beforeinstallprompt', (event) => {
    if (!isInstallPrompt(event)) return;
    event.preventDefault();
    deferredPrompt = event;
    changed();
  });
  window.addEventListener('appinstalled', () => {
    deferredPrompt = null;
    write(INSTALLED, '1');
    changed();
  });
}

/** How Not now has put the offer away: how many times, at which visit and when, the last time. */
export interface InstallSnooze {
  times: number;
  visit: number;
  at: number;
}

/**
 * Whether Not now still holds the offer back (the owner, 17 Nov): the first holds it for the rest of that visit, so it
 * comes back on the next; the second for a day, then 3 days, 7 days, and 30 days each time after.
 */
export function isSnoozed(snooze: InstallSnooze | null, visits: number, now: number): boolean {
  if (snooze === null || snooze.times < 1) return false;
  if (snooze.times === 1) return visits <= snooze.visit;
  const days = LATER_DAYS[Math.min(snooze.times - 2, LATER_DAYS.length - 1)] ?? 30;
  return now < snooze.at + days * DAY_MS;
}

/** The kept Not now, or null where it cannot be read: as if never put away. */
function parseSnooze(kept: string): InstallSnooze | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(kept);
  } catch {
    return null;
  }
  if (typeof parsed !== 'object' || parsed === null) return null;
  const snooze = { times: Number(Reflect.get(parsed, 'times')), visit: Number(Reflect.get(parsed, 'visit')), at: Number(Reflect.get(parsed, 'at')) };
  return Object.values(snooze).every(Number.isFinite) ? snooze : null;
}

// Put away for good before #1054: counted as one Not now at no visit, so it is offered again now.
const PUT_AWAY_BEFORE = JSON.stringify({ times: 1, visit: 0, at: 0 });

/** Not now as kept, as text, so Home and Profile read the same and hear each other's changes. */
function readSnoozeText(): string | null {
  return read(SNOOZED) ?? (read(DISMISSED) === '1' ? PUT_AWAY_BEFORE : null);
}

/** How the offer on Home installs the app: the browser's own prompt, or the steps on an iPhone (Safari's Share menu, F-183). */
export type InstallOfferKind = 'prompt' | 'ios' | null;

/**
 * How Profile's row puts the app on the home screen: as Home's offer, or on an Android phone whose browser gave no
 * prompt, the steps in its menu (#1054); null where none is known.
 */
export type InstallWay = 'prompt' | 'ios' | 'android' | null;

export function installWay(state: { canPrompt: boolean; isIphone: boolean; isAndroid: boolean }): InstallWay {
  if (state.canPrompt) return 'prompt';
  if (state.isIphone) return 'ios';
  return state.isAndroid ? 'android' : null;
}

/**
 * Whether to offer the app for the home screen on Home, and how. Only to a member (an iPhone installed before sign-up
 * loses the link's codes, decision 0031), from their first visit, never once installed, and not while Not now holds it.
 * An Android browser that gives no prompt may have it installed already, which it would not say, so Home offers nothing
 * there; Profile's row has the steps.
 */
export function installOfferKind(state: {
  isMember: boolean;
  installed: boolean;
  snoozed: boolean;
  canPrompt: boolean;
  isIphone: boolean;
}): InstallOfferKind {
  if (!state.isMember || state.installed || state.snoozed) return null;
  if (state.canPrompt) return 'prompt';
  return state.isIphone ? 'ios' : null;
}

/** Installed already: the store app (decision 0361), the web app opened from the home screen, or installed from this browser. */
function isInstalled(): boolean {
  if (Capacitor.isNativePlatform()) return true;
  const standalone = typeof window.matchMedia === 'function' && window.matchMedia('(display-mode: standalone)').matches;
  return standalone || Reflect.get(navigator, 'standalone') === true || read(INSTALLED) === '1';
}

/**
 * The install offer for the signed-in member, with Install and Not now (`kind`, on Home), and the way to install from
 * Profile while the app is not installed, whatever Not now said (`way`).
 */
export function useInstallOffer(isMember: boolean) {
  const canPrompt = useSyncExternalStore(subscribe, () => deferredPrompt !== null, () => false);
  const visits = useSyncExternalStore(subscribe, readVisits, () => 0);
  const snoozeText = useSyncExternalStore(subscribe, readSnoozeText, () => null);
  const snooze = snoozeText === null ? null : parseSnooze(snoozeText);
  const dismiss = () => {
    const now = readSnoozeText();
    const times = (now === null ? null : parseSnooze(now))?.times ?? 0;
    write(SNOOZED, JSON.stringify({ times: times + 1, visit: readVisits(), at: Date.now() }));
    changed();
  };
  // The browser's own dialog is the answer: once installed, `appinstalled` says so; a no counts as Not now.
  const install = () => {
    void deferredPrompt?.prompt();
    deferredPrompt = null;
    dismiss();
    changed();
  };
  const phone = { canPrompt, isIphone: /iPhone|iPad|iPod/.test(navigator.userAgent), isAndroid: /Android/.test(navigator.userAgent) };
  const installed = isInstalled();
  const kind = installOfferKind({ ...phone, isMember, installed, snoozed: isSnoozed(snooze, visits, Date.now()) });
  const way = installed ? null : installWay(phone);
  return { kind, way, install, dismiss };
}
