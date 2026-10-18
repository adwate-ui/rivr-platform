import { describe, expect, it } from 'vitest';
import { createFakeSocialInbox, type InboxMessage } from './index.ts';

function message(id: string, channel: InboxMessage['channel'], receivedAt: string): InboxMessage {
  return { id, channel, threadId: `thread-${id}`, fromHandle: 'a.member', text: 'Is Table 5 open tonight?', receivedAt: new Date(receivedAt) };
}

describe('fake social inbox', () => {
  it('lists the messages of one channel received at or after a time', async () => {
    const inbox = createFakeSocialInbox();
    inbox.receive(message('1', 'instagram', '2026-11-16T18:00:00Z'));
    inbox.receive(message('2', 'instagram', '2026-11-16T18:30:00Z'));
    inbox.receive(message('3', 'whatsapp', '2026-11-16T18:30:00Z'));

    const listed = await inbox.listMessages({ channel: 'instagram', since: new Date('2026-11-16T18:30:00Z') });

    expect(listed.ok && listed.value.map((received) => received.id)).toEqual(['2']);
  });

  it('records replies', async () => {
    const inbox = createFakeSocialInbox();

    expect(await inbox.reply({ channel: 'facebook', threadId: 'thread-9', text: 'Yes, from 22:00.' })).toEqual({
      ok: true,
      value: { messageId: 'fake-reply-1' },
    });
    expect(inbox.calls).toEqual([{ method: 'reply', channel: 'facebook', threadId: 'thread-9', text: 'Yes, from 22:00.' }]);
  });

  it('fails the next call when a test scripts it', async () => {
    const inbox = createFakeSocialInbox();
    inbox.failNext({ code: 'unavailable' });

    expect(await inbox.listMessages({ channel: 'facebook', since: new Date(0) })).toEqual({ ok: false, error: { code: 'unavailable' } });
  });
});
