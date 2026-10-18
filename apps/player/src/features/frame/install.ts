import { useState, useSyncExternalStore } from 'react';

/** Chromium's install prompt, which TypeScript's DOM types do not describe. */
interface InstallPromptEvent extends Event {
  prompt: () => Promise<unknown>;
}

const VISITS = 'rivr-visits';
const DISMISSED = 'rivr-install-dismissed';
// Set for the life of the tab or installed app: a reload, an update or the return from DigiLocker
// is the same visit, not a second one.
const COUNTED = 'rivr-visit-counted';

let deferredPrompt: InstallPromptEvent | null = null;
const listeners = new Set<() => void>();

function changed() {
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

// Storage can be off (private browsing); the offer then simply never shows.
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

/** Counts this opening of the app as a visit, once however often the page loads in it. */
function countVisit() {
  try {
    if (sessionStorage.getItem(COUNTED) === '1') return;
    sessionStorage.setItem(COUNTED, '1');
  } catch {
    return;
  }
  write(VISITS, String(Number(read(VISITS) ?? '0') + 1));
}

/**
 * Counts this opening of the app, and keeps the browser's install prompt for later: it fires once,
 * often before the screen that offers it has drawn. Called once, at start (main.tsx).
 */
export function startInstallWatch() {
  countVisit();
  window.addEventListener('beforeinstallprompt', (event) => {
    if (!isInstallPrompt(event)) return;
    event.preventDefault();
    deferredPrompt = event;
    changed();
  });
  window.addEventListener('appinstalled', () => {
    deferredPrompt = null;
    changed();
  });
}

export type InstallOfferKind = 'prompt' | 'ios' | null;

/**
 * Whether to offer the app for the home screen, and how. Only to a member (an iPhone installed before
 * sign-up loses the link's codes, decision 0031), from their second visit, and never once installed
 * or put away.
 */
export function installOfferKind(state: {
  visits: number;
  isMember: boolean;
  installed: boolean;
  dismissed: boolean;
  canPrompt: boolean;
  isIphone: boolean;
}): InstallOfferKind {
  if (!state.isMember || state.visits < 2 || state.installed || state.dismissed) return null;
  if (state.canPrompt) return 'prompt';
  return state.isIphone ? 'ios' : null;
}

function isInstalled(): boolean {
  const standalone = typeof window.matchMedia === 'function' && window.matchMedia('(display-mode: standalone)').matches;
  return standalone || Reflect.get(navigator, 'standalone') === true;
}

/** The install offer for the signed-in member, with Install and Not now. */
export function useInstallOffer(isMember: boolean) {
  const canPrompt = useSyncExternalStore(subscribe, () => deferredPrompt !== null, () => false);
  const [dismissed, setDismissed] = useState(() => read(DISMISSED) === '1');
  const dismiss = () => {
    write(DISMISSED, '1');
    setDismissed(true);
  };
  // The browser's own dialog is the answer, yes or no: the offer is not made again.
  const install = () => {
    void deferredPrompt?.prompt();
    deferredPrompt = null;
    dismiss();
    changed();
  };
  const kind = installOfferKind({
    visits: Number(read(VISITS) ?? '0'),
    isMember,
    installed: isInstalled(),
    dismissed,
    canPrompt,
    isIphone: /iPhone|iPad|iPod/.test(navigator.userAgent),
  });
  return { kind, install, dismiss };
}
