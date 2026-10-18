import { en } from './catalogue/en/index.ts';
import type { MessageKey, MessageParams } from './catalogue/types.ts';

/** Looks up one message key. `{name}` placeholders are filled from `params`. */
export type Translate = (key: MessageKey, params?: MessageParams) => string;

function lookup(key: MessageKey): string {
  let node: unknown = en;
  for (const part of key.split('.')) {
    node = typeof node === 'object' && node !== null ? Reflect.get(node, part) : undefined;
  }
  // The key type makes a miss impossible; showing the key beats showing nothing if it happens.
  return typeof node === 'string' ? node : key;
}

function fill(message: string, params: MessageParams): string {
  return message.replace(/\{(\w+)\}/g, (placeholder, name: string) =>
    name in params ? String(params[name]) : placeholder,
  );
}

/** The message for a key, placeholders filled: `t('common.featureLocked', { tiers })`. */
export const t: Translate = (key, params = {}) => fill(lookup(key), params);
