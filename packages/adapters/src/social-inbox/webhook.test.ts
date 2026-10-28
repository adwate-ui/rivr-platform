import { createHmac } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { inboxMessagesFrom, isMetaSignature } from './webhook.ts';

const sign = (body: string, secret: string) => `sha256=${createHmac('sha256', secret).update(body).digest('hex')}`;

describe('isMetaSignature', () => {
  it('takes the app secret\u2019s signature of the body, and nothing else', async () => {
    const body = '{"object":"page"}';
    expect(await isMetaSignature(body, sign(body, 'secret'), 'secret')).toBe(true);
    expect(await isMetaSignature(`${body} `, sign(body, 'secret'), 'secret')).toBe(false);
    expect(await isMetaSignature(body, sign(body, 'other'), 'secret')).toBe(false);
    expect(await isMetaSignature(body, sign(body, 'secret').replace('sha256=', 'sha1='), 'secret')).toBe(false);
    expect(await isMetaSignature(body, null, 'secret')).toBe(false);
    expect(await isMetaSignature(body, sign(body, ''), '')).toBe(false);
  });
});

describe('inboxMessagesFrom', () => {
  it('reads Instagram and Facebook messages by sender, leaving out the club\u2019s own echoes and anything not text', () => {
    const event = (mid: string, extra = {}) => ({ sender: { id: '1784' }, timestamp: 1_763_229_600_000, message: { mid, text: 'Is there a game tonight?', ...extra } });
    expect(inboxMessagesFrom({ object: 'instagram', entry: [{ messaging: [event('m1'), event('m2', { is_echo: true }), { sender: { id: '1784' }, timestamp: 1, message: { mid: 'm3' } }] }] }))
      .toEqual([{ id: 'm1', channel: 'instagram', threadId: '1784', fromHandle: '1784', text: 'Is there a game tonight?', receivedAt: new Date(1_763_229_600_000) }]);
    expect(inboxMessagesFrom({ object: 'page', entry: [{ messaging: [event('f1')] }] })[0]?.channel).toBe('facebook');
  });

  it('reads WhatsApp text messages by number, with its +', () => {
    const payload = { object: 'whatsapp_business_account', entry: [{ changes: [{ value: { messages: [
      { id: 'wamid.1', from: '919876543210', timestamp: '1763229600', type: 'text', text: { body: 'Hi' } },
      { id: 'wamid.2', from: '919876543210', timestamp: '1763229600', type: 'image', image: {} },
    ] } }] }] };
    expect(inboxMessagesFrom(payload)).toEqual([
      { id: 'wamid.1', channel: 'whatsapp', threadId: '+919876543210', fromHandle: '+919876543210', text: 'Hi', receivedAt: new Date(1_763_229_600_000) },
    ]);
  });

  it('reads nothing from any other object', () => {
    expect(inboxMessagesFrom({ object: 'user', entry: [] })).toEqual([]);
    expect(inboxMessagesFrom(null)).toEqual([]);
  });
});
