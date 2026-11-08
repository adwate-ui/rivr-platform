import type { SentMessage } from './consumers.ts';

/** One sim.message row: who it went to, which member it was about, and what it said. */
export interface MessageRow {
  channel: SentMessage['channel'];
  consumer: string;
  kind: string;
  recipient: string | null;
  member_id: string | null;
  body: string;
  payload: unknown;
}

function field(value: unknown, name: string): unknown {
  return typeof value === 'object' && value !== null ? Reflect.get(value, name) : undefined;
}

function text(value: unknown): string | null {
  return typeof value === 'string' ? value : null;
}

/** A WhatsApp message goes to a number; a push to a subscription's endpoint. */
function recipientOf(sent: SentMessage): string | null {
  return sent.channel === 'whatsapp' ? text(field(sent.message, 'to')) : text(field(field(sent.message, 'subscription'), 'endpoint'));
}

/** The words: a template and its parameters for WhatsApp, a title and body for push. */
function bodyOf(sent: SentMessage): string {
  if (sent.channel === 'push') return `${text(field(sent.message, 'title')) ?? ''} | ${text(field(sent.message, 'body')) ?? ''}`;
  const params = field(sent.message, 'params');
  const words = Array.isArray(params) ? params.map(String).join(' | ') : '';
  return `${text(field(sent.message, 'template')) ?? ''}: ${words}`;
}

export function toRow(sent: SentMessage): MessageRow {
  return {
    channel: sent.channel,
    consumer: sent.consumer,
    kind: sent.kind,
    recipient: recipientOf(sent),
    member_id: text(field(sent.payload, 'member_id')),
    body: bodyOf(sent),
    payload: { event: sent.payload, message: sent.message, delivered: sent.delivered },
  };
}
