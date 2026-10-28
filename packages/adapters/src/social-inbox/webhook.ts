import type { InboxMessage } from './types.ts';

const field = (row: unknown, name: string): unknown => (typeof row === 'object' && row !== null ? Reflect.get(row, name) : undefined);
const list = (value: unknown): unknown[] => (Array.isArray(value) ? value : []);
const textOf = (value: unknown): string | null => (typeof value === 'string' ? value : null);

/** A hex string of bytes. */
const hex = (bytes: Uint8Array) => Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');

/**
 * Whether a Meta webhook's X-Hub-Signature-256 is `sha256=` and the app secret's HMAC-SHA256 of the raw body (#156),
 * compared in a time that does not depend on where they differ. Runs under Deno and Node.
 */
export async function isMetaSignature(rawBody: string, header: string | null, appSecret: string): Promise<boolean> {
  if (header === null || !header.startsWith('sha256=') || appSecret === '') return false;
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey('raw', encoder.encode(appSecret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const expected = hex(new Uint8Array(await crypto.subtle.sign('HMAC', key, encoder.encode(rawBody))));
  const given = header.slice('sha256='.length);
  let difference = given.length ^ expected.length;
  for (let at = 0; at < expected.length; at += 1) difference |= given.charCodeAt(at) ^ expected.charCodeAt(at);
  return difference === 0;
}

/** An Instagram or Facebook message: the sender's id is both the conversation and who wrote. The club's own replies (echoes) are left out. */
function messengerMessage(channel: 'instagram' | 'facebook', event: unknown): InboxMessage | null {
  const message = field(event, 'message');
  const [id, body, sender] = [textOf(field(message, 'mid')), textOf(field(message, 'text')), textOf(field(field(event, 'sender'), 'id'))];
  const at = field(event, 'timestamp');
  if (id === null || body === null || sender === null || typeof at !== 'number' || field(message, 'is_echo') === true) return null;
  return { id, channel, threadId: sender, fromHandle: sender, text: body, receivedAt: new Date(at) };
}

/** A WhatsApp text message: the sender's number, with its +, is both the conversation and who wrote. */
function whatsAppMessage(message: unknown): InboxMessage | null {
  const [id, from, body] = [textOf(field(message, 'id')), textOf(field(message, 'from')), textOf(field(field(message, 'text'), 'body'))];
  const at = Number(textOf(field(message, 'timestamp')));
  if (id === null || from === null || body === null || !Number.isFinite(at) || !/^\d{8,15}$/.test(from)) return null;
  return { id, channel: 'whatsapp', threadId: `+${from}`, fromHandle: `+${from}`, text: body, receivedAt: new Date(at * 1000) };
}

/** The text messages in a Meta webhook (#156): Instagram, Facebook (Messenger) and WhatsApp; anything else is left out. */
export function inboxMessagesFrom(payload: unknown): InboxMessage[] {
  const object = field(payload, 'object');
  const entries = list(field(payload, 'entry'));
  if (object === 'instagram' || object === 'page') {
    const channel = object === 'instagram' ? 'instagram' : 'facebook';
    return entries.flatMap((entry) => list(field(entry, 'messaging')).flatMap((event) => messengerMessage(channel, event) ?? []));
  }
  if (object !== 'whatsapp_business_account') return [];
  return entries.flatMap((entry) => list(field(entry, 'changes'))
    .flatMap((change) => list(field(field(change, 'value'), 'messages')).flatMap((message) => whatsAppMessage(message) ?? [])));
}
