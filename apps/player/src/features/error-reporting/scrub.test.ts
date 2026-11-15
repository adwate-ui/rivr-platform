import type { ErrorEvent as SentryEvent } from '@sentry/react';
import { describe, expect, it } from 'vitest';
import { scrubBreadcrumb, scrubEvent, scrubText, scrubUrl } from './scrub.ts';

// Built here, not written out, so no scanner takes the examples for real secrets.
const TOKEN = ['eyJhbGciOiJIUzI1NiJ9', 'eyJzdWIiOiJ4In0', 'c2lnbmF0dXJl'].join('.');
const KEY = 'a1B2'.repeat(10);
const ROW_ID = '3f2b8a1c-9d4e-4f6a-8b7c-1a2b3c4d5e6f';
const EN_DASH = String.fromCharCode(0x2013);
const FULL_WIDTH = [9, 8, 1, 2, 3, 4, 5, 6, 7, 8].map((digit) => String.fromCharCode(0xff10 + digit)).join('');
const BACKTICK = String.fromCharCode(96);

describe('scrubText', () => {
  it.each([
    ['a phone number with its country code', 'No member for +91 98765 43210', 'No member for [number]'],
    ['a phone number typed in one run', 'otp failed for 9876543210', 'otp failed for [number]'],
    ['a phone number in groups of three', 'call 987-654-3210 back', 'call [number] back'],
    ['a phone number with brackets', 'call (987) 654-3210 back', 'call ([number] back'],
    ['a phone number with commas or slashes', 'phone 98,765,43,210 or 987 / 654 / 3210', 'phone [number] or [number]'],
    ['a phone number with another dash', `otp for 981${EN_DASH}234${EN_DASH}5678`, 'otp for [number]'],
    ['a phone number with underscores', 'file selfie_981_234_5678', 'file selfie_[number]'],
    ['a phone number in pairs, widely spaced', 'call 98 -- 12 -- 34 -- 56 -- 78', 'call [number]'],
    ['a number in Devanagari digits', 'phone ९८७६५४३२१०', 'phone [number]'],
    ['a number in full-width digits', `phone ${FULL_WIDTH}`, 'phone [number]'],
    ['an Aadhaar number, spaced', 'aadhaar 1234 5678 9012 refused', 'aadhaar [number] refused'],
    ['an Aadhaar number, masked', 'aadhaar XXXX XXXX 9012 refused', 'aadhaar XXXX XXXX [number] refused'],
    ['a sign-in code', 'code 123456 is wrong', 'code [number] is wrong'],
    ['a PAN', 'PAN ABCDE1234F does not match', 'PAN [pan] does not match'],
    ['a PAN in small letters', 'pan abcde1234f', 'pan [pan]'],
    ['a PAN joined to other words', 'pan_ABCDE1234F, ABCDE1234F_front.jpg, panABCDE1234F', 'pan_[pan], [pan]_front.jpg, pan[pan]'],
    ['a PAN with its parts spaced or dashed', 'PAN ABCDE 1234 F or ABCDE-1234-F', 'PAN [pan] or [pan]'],
    ['an email address', 'no account for asha.verma@example.com or asha@localhost', 'no account for [email] or [email]'],
    ['an email address as an address carries it', 'GET /rest/v1/rpc/x/asha.verma%40example.com', 'GET /rest/v1/rpc/x/[email]'],
    ['a sign-in token', `Bearer ${TOKEN} expired`, 'Bearer [token] expired'],
    ['a key or a hash', `key ${KEY} refused`, 'key [token] refused'],
    ['a row id', `member ${ROW_ID} not found`, 'member [id] not found'],
    ['a photo written out as text', 'cannot draw data:image/jpeg;base64,/9j/4AAQSkZJRg==', 'cannot draw [data]'],
    ['the value the database quotes back', 'Key (full_name)=(Asha (Ash) Verma) already exists', 'Key (full_name)=([value])'],
    ['the row the database quotes back', `Failing row contains (${ROW_ID}, Asha Verma, +919876543210, ABCDE1234F, null).`, 'Failing row contains [row]'],
    ['a value the database could not read', 'invalid input syntax for type uuid: "asha.verma"', 'invalid input syntax for type uuid: "[text]"'],
    ['what a browser quotes back', 'Unexpected token \'A\', "Asha Verma" is not valid JSON', 'Unexpected token \'A\', "[text]" is not valid JSON'],
    ['more than one word in single quotes', "Cannot read properties of undefined (reading 'Asha Verma')", "Cannot read properties of undefined (reading '[text]')"],
    ['what a promise was rejected with', 'Non-Error promise rejection captured with value: Asha Verma', 'Non-Error promise rejection captured with value: [value]'],
    ['the message of an event thrown as it was', `Event ${BACKTICK}ErrorEvent${BACKTICK} captured as exception with message ${BACKTICK}Asha Verma${BACKTICK}`, `Event ${BACKTICK}ErrorEvent${BACKTICK} captured as exception with message [value]`],
  ])('names %s without giving it', (_what, text, scrubbed) => {
    expect(scrubText(text)).toBe(scrubbed);
  });

  it.each([
    ['an address', 'Failed to fetch https://club.example/rest/v1/member?phone=eq.%2B919876543210&select=full_name#top (offline)', 'Failed to fetch https://club.example/rest/v1/member (offline)'],
    ['a path', 'Not found: /kyc/return?state=xyz&name=Asha', 'Not found: /kyc/return'],
    ['an address with brackets in its filter', 'GET https://club.example/rest/v1/m?or=(full_name.eq.Asha)&name=Verma failed', 'GET https://club.example/rest/v1/m failed'],
    ['an address that is not http', 'closed wss://club.example/realtime/v1/websocket?apikey=abc&vsn=1.0.0', 'closed wss://club.example/realtime/v1/websocket'],
  ])('cuts the query string and fragment off %s in the words', (_what, text, scrubbed) => {
    expect(scrubText(text)).toBe(scrubbed);
  });

  it('leaves an ordinary error as it was written, with the names from the code and the database', () => {
    const ordinary = [
      "Cannot read properties of undefined (reading 'map')",
      'Request failed with status 500',
      'Failed to fetch dynamically imported module',
      'new row for relation "member" violates check constraint "member_phone_check"',
      'duplicate key value violates unique constraint "member_phone_key"',
      'refused:not_live',
      'read:member:42x501',
      'sign_up_invalid:fullName,city,occupation',
    ];
    for (const text of ordinary) expect(scrubText(text)).toBe(text);
  });

  // No rule can tell these from ordinary words (decision 0604); nothing in the app puts them in an error today.
  it('cannot tell a number under four digits, or one word in single quotes, from ordinary text', () => {
    expect(scrubText('member 104 not found')).toBe('member 104 not found');
    expect(scrubText("no such key 'asha'")).toBe("no such key 'asha'");
  });

  it('costs little however long and however hostile the words are', () => {
    const hostile = ['a.'.repeat(10_000), '1 '.repeat(10_000), 'eyJ'.repeat(7_000), '"\''.repeat(10_000), `/sessions/${'a.'.repeat(10_000)}`];
    const startedAt = performance.now();
    for (const text of hostile) {
      scrubText(text);
      scrubUrl(text);
    }
    // A string of 20,000 dotted letters took seven seconds before the rules were bounded.
    expect(performance.now() - startedAt).toBeLessThan(500);
  });
});

describe('scrubUrl', () => {
  it('keeps where a request went and drops its query string', () => {
    expect(scrubUrl('https://club.example/rest/v1/member?user_id=eq.1&select=full_name,phone')).toBe('https://club.example/rest/v1/member');
    expect(scrubUrl('/sign-up?next=%2Fbonus#form')).toBe('/sign-up');
  });

  it('names the ids, numbers and addresses in a path', () => {
    expect(scrubUrl(`https://club.example/storage/v1/object/kyc/${ROW_ID}/selfie.jpg`)).toBe('https://club.example/storage/v1/object/kyc/[id]/selfie.jpg');
    expect(scrubUrl('/members/919876543210')).toBe('/members/[number]');
    expect(scrubUrl('/rest/v1/rpc/find/%2B919876543210')).toBe('/rest/v1/rpc/find/%2B[number]');
    expect(scrubUrl('https://club.example/rest/v1/member/asha.verma@example.com')).toBe('https://club.example/rest/v1/member/[email]');
  });

  it('sends nothing of an address that is not a web address', () => {
    expect(scrubUrl('data:image/jpeg;base64,/9j/4AAQSkZJRg==')).toBe('[address]');
    expect(scrubUrl('blob:https://club.example/3f2b8a1c')).toBe('[address]');
  });
});

describe('scrubBreadcrumb', () => {
  it('keeps a request as its method, address and status only', () => {
    const kept = scrubBreadcrumb({
      category: 'fetch', type: 'http', message: 'for Asha Verma',
      data: { method: 'POST', url: 'https://club.example/auth/v1/otp?phone=919876543210', status_code: 422, request_body_size: 31, 'url.query': '?phone=919876543210' },
    });
    expect(kept).toEqual({ category: 'fetch', type: 'http', data: { method: 'POST', url: 'https://club.example/auth/v1/otp', status_code: 422 } });
  });

  it('keeps a move between screens without what either address carried', () => {
    const kept = scrubBreadcrumb({ category: 'navigation', data: { from: '/sign-in?next=%2Fcard', to: `/sessions/${ROW_ID}` } });
    expect(kept).toEqual({ category: 'navigation', data: { from: '/sign-in', to: '/sessions/[id]' } });
  });

  it('drops a click, a keypress and a console line', () => {
    for (const category of ['ui.click', 'ui.input', 'console', 'sentry.event']) {
      expect(scrubBreadcrumb({ category, message: 'button[aria-label="Remove Asha Verma"]' })).toBeNull();
    }
  });

  it('keeps a request that came with no details, as one to nowhere', () => {
    expect(scrubBreadcrumb({ category: 'fetch' })).toEqual({ category: 'fetch', data: { method: 'undefined', url: '[address]' } });
  });
});

describe('scrubEvent', () => {
  const event: SentryEvent = {
    type: undefined,
    event_id: 'e1',
    user: { id: ROW_ID, username: 'Asha Verma', ip_address: '203.0.113.7' },
    extra: { form: { fullName: 'Asha Verma', pan: 'ABCDE1234F' } },
    contexts: { member: { phone: '+919876543210' } },
    message: 'Asha Verma could not sign up',
    transaction: `/sessions/${ROW_ID}`,
    fingerprint: ['Asha Verma'],
    debug_meta: { images: [{ type: 'sourcemap', code_file: `https://app.example/sessions/${ROW_ID}`, debug_id: 'd1' }] },
    request: { url: `https://app.example/kyc/return?code=${KEY}`, headers: { 'User-Agent': 'TestBrowser/1', Referer: 'https://app.example/sign-in?phone=919876543210' }, cookies: { session: KEY } },
    breadcrumbs: [{ category: 'ui.click', message: 'button[aria-label="Asha Verma"]' }, { category: 'fetch', data: { method: 'GET', url: '/rest/v1/member?phone=eq.919876543210', status_code: 200 } }],
    exception: {
      values: [{
        type: 'Error',
        value: 'No member for +91 98765 43210',
        module: 'asha',
        mechanism: { type: 'generic', handled: true, data: { phone: '9876543210' } },
        stacktrace: { frames: [{ filename: 'https://app.example/assets/index-a1b2.js?v=3', function: 'signUp', module: 'asha', lineno: 1, colno: 2040, vars: { phone: '9876543210' }, context_line: 'const pan = "ABCDE1234F"' }] },
      }],
    },
  };

  it('sends the error, where it was thrown, the requests before it, the browser and the tags, and nothing else', () => {
    expect(scrubEvent(event, { app: 'player', route: '/sessions/$sessionId' })).toEqual({
      type: undefined,
      event_id: 'e1',
      tags: { app: 'player', route: '/sessions/$sessionId', kind: 'error' },
      request: { url: 'https://app.example/kyc/return', headers: { 'User-Agent': 'TestBrowser/1' } },
      breadcrumbs: [{ category: 'fetch', data: { method: 'GET', url: '/rest/v1/member', status_code: 200 } }],
      exception: {
        values: [{
          type: 'Error',
          value: 'No member for [number]',
          mechanism: { type: 'generic', handled: true },
          stacktrace: { frames: [{ filename: 'https://app.example/assets/index-a1b2.js', function: 'signUp', lineno: 1, colno: 2040 }] },
        }],
      },
    });
  });

  it('scrubs the page address a browser gives as the file of an error with none, and leaves a script its name', () => {
    const frames = [{ filename: `https://app.example/sessions/${ROW_ID}?code=1` }, { abs_path: 'https://app.example/members/919876543210' }, { filename: 'https://app.example/assets/index-B1234x.js?v=3' }];
    const sent = scrubEvent({ type: undefined, exception: { values: [{ stacktrace: { frames } }] } }, {});
    expect(sent.exception?.values?.[0]?.stacktrace?.frames).toEqual([
      { filename: 'https://app.example/sessions/[id]' },
      { abs_path: 'https://app.example/members/[number]' },
      { filename: 'https://app.example/assets/index-B1234x.js' },
    ]);
  });

  it('scrubs an error\'s kind and the names of the functions it passed through', () => {
    const values = [{ type: 'Asha Verma', value: 'x', stacktrace: { frames: [{ function: 'send_9876543210' }] } }, { type: 'TypeError', value: 'y' }];
    const sent = scrubEvent({ type: undefined, exception: { values } }, {});
    expect(sent.exception?.values).toEqual([{ type: 'Error', value: 'x', stacktrace: { frames: [{ function: 'send_[number]' }] } }, { type: 'TypeError', value: 'y' }]);
  });

  it('sends none of the words of a value thrown that was not an error: they are any words at all', () => {
    const thrown: SentryEvent = { type: undefined, exception: { values: [{ type: 'Error', value: 'Asha Verma could not sign up' }, { type: 'UnhandledRejection', value: 'Asha Verma' }] } };
    expect(scrubEvent(thrown, {}, 'value').exception?.values?.map(({ value }) => value)).toEqual(['[value]', '[value]']);
  });

  it('marks a failure a screen handled, and makes each code an issue of its own', () => {
    const handled: SentryEvent = { type: undefined, exception: { values: [{ type: 'HandledFailure', value: 'refused:not_live' }] } };
    const sent = scrubEvent(handled, { app: 'player', route: '/kyc' }, 'handled');
    expect(sent.tags).toEqual({ app: 'player', route: '/kyc', kind: 'handled' });
    expect(sent.fingerprint).toEqual(['handled', 'refused:not_live']);
  });

  it('leaves no name, number, id or key anywhere in what is sent', () => {
    const sent = JSON.stringify(scrubEvent(event, { app: 'player', route: '/kyc/return' }));
    expect(sent).not.toMatch(/Asha|Verma|asha|98765|ABCDE1234F|203\.0\.113\.7|3f2b8a1c|a1B2a1B2/);
  });
});
