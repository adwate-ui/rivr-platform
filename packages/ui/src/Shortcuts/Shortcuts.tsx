import { t } from '@rivr/i18n';
import { createContext, useContext, useEffect, useId, useRef, useState, useSyncExternalStore, type ReactNode } from 'react';

/** One keyboard shortcut in a list: the keys as written ("/", "Ctrl K") and what they do ("Search"). */
export interface ShortcutHint {
  readonly keys: string;
  readonly label: string;
}

/** A key that does something on the screen open now. */
export interface ShortcutBinding {
  /** The key as `KeyboardEvent.key` reads it; a letter in either case: `a`, `s`. */
  key: string;
  /** What it does, already translated: "Approve the oldest request". The shortcuts list and the tooltip say it. */
  label: string;
  onPress: () => void;
  /** False while there is nothing to do, such as no request to approve: the key neither works nor shows. */
  isEnabled?: boolean;
}

/** What `useShortcut` gives back for the control that does the same: `Button`'s `shortcut`. */
export interface ButtonShortcut {
  /** The key as shown and announced: `S`. */
  readonly key: string;
  /** The control's tooltip with its key: "Seat a player (S)". */
  readonly hint: string;
}

interface Registry {
  readonly register: (id: string, binding: Required<Omit<ShortcutBinding, 'isEnabled'>>) => () => void;
  readonly subscribe: (listener: () => void) => () => void;
  readonly list: () => readonly ShortcutHint[];
  readonly press: (key: string) => boolean;
}

const ShortcutContext = createContext<Registry | null>(null);
// The staff member's switch for single-key shortcuts (WCAG 2.1.4): on unless they turn it off in the account menu.
const ShortcutsOnContext = createContext(true);

const shown = (key: string) => (key.length === 1 ? key.toUpperCase() : key);

function createRegistry(): Registry {
  const bindings = new Map<string, Required<Omit<ShortcutBinding, 'isEnabled'>>>();
  const listeners = new Set<() => void>();
  let hints: readonly ShortcutHint[] = [];
  const changed = () => {
    // In the order of their keys, A before D before S, however the screen offered them.
    hints = [...bindings.values()].map((binding) => ({ keys: shown(binding.key), label: binding.label }))
      .sort((a, b) => a.keys.localeCompare(b.keys));
    listeners.forEach((listener) => listener());
  };
  return {
    register: (id, binding) => {
      bindings.set(id, binding);
      changed();
      return () => {
        bindings.delete(id);
        changed();
      };
    },
    subscribe: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    list: () => hints,
    // The latest binding for a key wins, as the screen open last registered it.
    press: (key) => {
      const binding = [...bindings.values()].reverse().find((one) => one.key.toLowerCase() === key.toLowerCase());
      binding?.onPress();
      return binding !== undefined;
    },
  };
}

/** True while the staff member types in a field, or works in a sheet or the search, where a letter is never a shortcut. */
function isBusyElsewhere(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName) || target.closest('[role="dialog"]') !== null;
}

/**
 * Holds the keys the screen open now offers (console v3), and listens for them: a key does its job unless the staff member
 * is typing in a field, works in a sheet or the search, or holds Ctrl, Cmd or Alt. `isOn` false, the staff member's own
 * switch, turns every single-key shortcut off, `/` too (WCAG 2.1.4). Wrap the console's frame in it.
 */
export function ShortcutProvider({ isOn = true, children }: { isOn?: boolean; children: ReactNode }) {
  const [registry] = useState(createRegistry);
  useEffect(() => {
    if (!isOn) return undefined;
    const onKey = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.repeat || event.ctrlKey || event.metaKey || event.altKey || isBusyElsewhere(event.target)) return;
      if (registry.press(event.key)) event.preventDefault();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [registry, isOn]);
  return (
    <ShortcutContext.Provider value={registry}>
      <ShortcutsOnContext.Provider value={isOn}>{children}</ShortcutsOnContext.Provider>
    </ShortcutContext.Provider>
  );
}

/** Whether single-key shortcuts are on: the staff member's switch, given to ShortcutProvider. On outside one. */
export function useShortcutsOn(): boolean {
  return useContext(ShortcutsOnContext);
}

/**
 * Offers a key on the screen while it is mounted and enabled: `useShortcut({ key: 's', label: t('…'), onPress: seat })`.
 * Gives back the key and the tooltip for the button that does the same, `<Button shortcut={…}>`, or nothing while the
 * staff member has shortcuts off. Outside a ShortcutProvider it offers nothing, but still names the key.
 */
export function useShortcut({ key, label, onPress, isEnabled = true }: ShortcutBinding): ButtonShortcut | undefined {
  const registry = useContext(ShortcutContext);
  const isOn = useContext(ShortcutsOnContext);
  const id = useId();
  const latest = useRef(onPress);
  useEffect(() => {
    latest.current = onPress;
  });
  useEffect(() => {
    if (registry === null || !isEnabled || !isOn) return undefined;
    return registry.register(id, { key, label, onPress: () => latest.current() });
  }, [registry, id, key, label, isEnabled, isOn]);
  return isOn ? { key: shown(key), hint: t('ui.console.shortcuts.withKey', { label, key: shown(key) }) } : undefined;
}

const NONE: readonly ShortcutHint[] = [];

/** The keys the screen open now offers, in the order of their keys, for the shortcuts list; none while they are off. */
export function useShortcutList(): readonly ShortcutHint[] {
  const registry = useContext(ShortcutContext);
  const isOn = useContext(ShortcutsOnContext);
  const offered = useSyncExternalStore(registry?.subscribe ?? (() => () => undefined), registry?.list ?? (() => NONE));
  return isOn ? offered : NONE;
}
