import { describe, expect, it } from 'vitest';
import { createFacebookPageTarget, createInstagramTarget, createTelegramTarget } from './index.ts';

// The live targets against a fake fetch: what each sends its channel, and how each reply is read.

const POST = { caption: 'RIVR Sunday: ₹5,00,000 guaranteed', media: [{ url: 'https://cdn.example/social-media/v/post.jpg', kind: 'image' as const }] };

/** Answers each request with the next reply, recording what was asked. */
function fakeFetch(...replies: { status?: number; body: unknown }[]) {
  const requests: { url: string; init: RequestInit }[] = [];
  const fetch: typeof globalThis.fetch = async (input, init = {}) => {
    requests.push({ url: String(input), init });
    const reply = replies.shift() ?? { body: {} };
    return Response.json(reply.body, { status: reply.status ?? 200 });
  };
  return { fetch, requests };
}

const body = (request: { init: RequestInit } | undefined): unknown => JSON.parse(String(request?.init.body));

describe('Instagram', () => {
  it('makes a media container, publishes it, and returns its permalink', async () => {
    const { fetch, requests } = fakeFetch({ body: { id: 'c1' } }, { body: { id: 'm1' } }, { body: { permalink: 'https://www.instagram.com/p/C1/' } });
    const instagram = createInstagramTarget({ instagramUserId: '17841', accessToken: 'ig', fetch });

    expect(await instagram.publish(POST)).toEqual({ ok: true, value: { kind: 'published', channel: 'instagram', postUrl: 'https://www.instagram.com/p/C1/' } });
    expect(requests.map((request) => request.url)).toEqual([
      'https://graph.facebook.com/v23.0/17841/media', 'https://graph.facebook.com/v23.0/17841/media_publish', 'https://graph.facebook.com/v23.0/m1?fields=permalink',
    ]);
    expect(body(requests[0])).toEqual({ image_url: POST.media[0]?.url, caption: POST.caption });
    expect(body(requests[1])).toEqual({ creation_id: 'c1' });
    expect(requests[0]?.init.headers).toEqual({ authorization: 'Bearer ig', 'content-type': 'application/json' });
  });

  it('counts the post as published once Instagram took it, even when its link cannot be read', async () => {
    const { fetch } = fakeFetch({ body: { id: 'c1' } }, { body: { id: 'm1' } }, { status: 500, body: {} });
    expect(await createInstagramTarget({ instagramUserId: '1', accessToken: 't', fetch }).publish(POST))
      .toEqual({ ok: true, value: { kind: 'published', channel: 'instagram', postUrl: 'https://www.instagram.com/' } });
  });

  it('gives up on a refusal and retries a rate limit', async () => {
    const refused = createInstagramTarget({ instagramUserId: '1', accessToken: 't', fetch: fakeFetch({ status: 400, body: { error: { code: 9004 } } }).fetch });
    expect(await refused.publish(POST)).toEqual({ ok: false, error: { code: 'rejected', reason: 'Meta error 9004' } });
    const limited = createInstagramTarget({ instagramUserId: '1', accessToken: 't', fetch: fakeFetch({ status: 400, body: { error: { code: 4 } } }).fetch });
    expect(await limited.publish(POST)).toEqual({ ok: false, error: { code: 'rate_limited' } });
    expect(await refused.publish({ caption: 'No image', media: [] })).toEqual({ ok: false, error: { code: 'rejected', reason: 'the post has no image' } });
  });
});

describe('a Facebook Page', () => {
  it('posts the photo with the caption and returns the post\u2019s link', async () => {
    const { fetch, requests } = fakeFetch({ body: { id: 'p1', post_id: '123_456' } });
    const facebook = createFacebookPageTarget({ pageId: '123', pageToken: 'fb', fetch });

    expect(await facebook.publish(POST)).toEqual({ ok: true, value: { kind: 'published', channel: 'facebook', postUrl: 'https://www.facebook.com/123_456' } });
    expect(requests[0]?.url).toBe('https://graph.facebook.com/v23.0/123/photos');
    expect(body(requests[0])).toEqual({ url: POST.media[0]?.url, message: POST.caption });
  });

  it('retries an outage, and links the Page when the reply names no post', async () => {
    expect(await createFacebookPageTarget({ pageId: '1', pageToken: 't', fetch: fakeFetch({ status: 503, body: '<html>' }).fetch }).publish(POST))
      .toEqual({ ok: false, error: { code: 'unavailable' } });
    expect(await createFacebookPageTarget({ pageId: '1', pageToken: 't', fetch: fakeFetch({ body: {} }).fetch }).publish(POST))
      .toEqual({ ok: true, value: { kind: 'published', channel: 'facebook', postUrl: 'https://www.facebook.com/1' } });
  });
});

describe('a Telegram channel', () => {
  it('sends the photo through the bot and links the message by the channel\u2019s name, or its id', async () => {
    const { fetch, requests } = fakeFetch(
      { body: { ok: true, result: { message_id: 42, chat: { id: -1001234567890, username: 'rivrclub' } } } },
      { body: { ok: true, result: { message_id: 7, chat: { id: -1001234567890 } } } },
    );
    const telegram = createTelegramTarget({ botToken: 'bot1', chat: '@rivrclub', fetch });

    expect(await telegram.publish(POST)).toEqual({ ok: true, value: { kind: 'published', channel: 'telegram', postUrl: 'https://t.me/rivrclub/42' } });
    expect(await telegram.publish(POST)).toEqual({ ok: true, value: { kind: 'published', channel: 'telegram', postUrl: 'https://t.me/c/1234567890/7' } });
    expect(requests[0]?.url).toBe('https://api.telegram.org/botbot1/sendPhoto');
    expect(body(requests[0])).toEqual({ chat_id: '@rivrclub', photo: POST.media[0]?.url, caption: POST.caption });
  });

  it('gives up on a refusal such as a caption too long, and retries a rate limit', async () => {
    const refused = createTelegramTarget({ botToken: 'b', chat: '@c', fetch: fakeFetch({ status: 400, body: { ok: false, error_code: 400 } }).fetch });
    expect(await refused.publish(POST)).toEqual({ ok: false, error: { code: 'rejected', reason: 'Telegram error 400' } });
    const limited = createTelegramTarget({ botToken: 'b', chat: '@c', fetch: fakeFetch({ status: 429, body: { ok: false, error_code: 429 } }).fetch });
    expect(await limited.publish(POST)).toEqual({ ok: false, error: { code: 'rate_limited' } });
    const down: typeof globalThis.fetch = async () => { throw new TypeError('network down'); };
    expect(await createTelegramTarget({ botToken: 'b', chat: '@c', fetch: down }).publish(POST)).toEqual({ ok: false, error: { code: 'unavailable' } });
  });
});
