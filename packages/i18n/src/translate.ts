import { common } from './catalogue/en/common.ts';
import type { MessageKey, MessageParams } from './catalogue/types.ts';
import { ui } from './catalogue/en/ui.ts';

/** Looks up one message key. `{name}` placeholders are filled from `params`. */
export type Translate = (key: MessageKey, params?: MessageParams) => string;

// What t() reads: the copy every app shares (common, and @rivr/ui's), and the namespaces each app
// registers once at start, so an app ships only its own copy and not every other app's (#344).
const messages: Record<string, unknown> = { common, ui };

/** Adds namespaces to what t() reads, as each app does once at start: `registerMessages({ player: playerApp })`. */
export function registerMessages(namespaces: Readonly<Record<string, unknown>>): void {
  Object.assign(messages, namespaces);
}

function lookup(key: MessageKey): string {
  let node: unknown = messages;
  for (const part of key.split('.')) {
    node = typeof node === 'object' && node !== null ? Reflect.get(node, part) : undefined;
  }
  // The key type makes a miss impossible once the app registered its copy; showing the key beats showing nothing.
  return typeof node === 'string' ? node : key;
}

function fill(message: string, params: MessageParams): string {
  return message.replace(/\{(\w+)\}/g, (placeholder, name: string) =>
    name in params ? String(params[name]) : placeholder,
  );
}

/** The message for a key, placeholders filled: `t('common.featureLocked', { tiers })`. */
export const t: Translate = (key, params = {}) => fill(lookup(key), params);
