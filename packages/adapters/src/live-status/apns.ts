import { err, ok, type Result } from '@rivr/contracts';
import { z } from 'zod';
import { signJwt } from '../shared/jwt.ts';
import type { LiveStatus, LiveStatusAdapter, LiveStatusDevice, LiveStatusFailure } from './types.ts';

/** The club's Apple push key and the app it sends for (decision 0361). */
export interface ApnsLiveActivityOptions {
  /** The Apple developer team's id. */
  readonly teamId: string;
  /** The push key's id, from the developer account. */
  readonly keyId: string;
  /** The push key's `.p8` text (PKCS#8 PEM). */
  readonly privateKey: string;
  /** The app's bundle id, `club.rivr.player`. */
  readonly bundleId: string;
  /** Apple's sandbox for a development build; production for TestFlight and the App Store. */
  readonly environment: 'sandbox' | 'production';
  /** For tests; the platform's fetch by default. */
  readonly fetch?: typeof globalThis.fetch;
  /** For tests; the clock by default. */
  readonly now?: () => Date;
}

// The widget's ActivityAttributes type in the iOS app (ios/App/App/RivrLiveAttributes.swift): push-to-start names it.
const ATTRIBUTES_TYPE = 'RivrLiveAttributes';
// Apple takes a provider token for an hour and refuses a new one more often than every twenty minutes.
const TOKEN_LIFE_MS = 50 * 60 * 1000;

const replySchema = z.object({ reason: z.string() });

const seconds = (at: Date): number => Math.floor(at.getTime() / 1000);

type ActivityEvent = 'start' | 'update' | 'end';

/**
 * The widget's ContentState as RivrLiveAttributes decodes it. Times are seconds since 1970, which the widget turns into
 * dates itself: ActivityKit's own decoder would read a date as seconds since 2001.
 */
function contentStateOf(status: LiveStatus) {
  return {
    kind: status.kind,
    meta: status.meta,
    label: status.label,
    value: status.value,
    startsAt: status.countdown === null ? null : seconds(status.countdown.startsAt),
    endsAt: status.countdown === null ? null : seconds(status.countdown.endsAt),
    actionTitle: status.action?.title ?? null,
    actionUrl: status.action?.url ?? null,
  };
}

/** What an ended Live Activity's last push carries: nothing to show. */
const ENDED_STATE = { kind: 'ended', meta: '', label: '', value: null, startsAt: null, endsAt: null, actionTitle: null, actionUrl: null };

/** The `aps` of one Live Activity push (Apple's "Starting and updating Live Activities with ActivityKit push notifications"). */
function apsOf(event: ActivityEvent, status: LiveStatus | null, now: Date): Record<string, unknown> {
  const timestamp = seconds(now);
  if (status === null) return { timestamp, event, 'content-state': ENDED_STATE, 'dismissal-date': timestamp };
  // A status that sounds (the seat call) has its alert, with the phone's sound. Starting needs an alert too: a quiet one.
  const quietStart = event === 'start' ? { title: status.label, body: status.value ?? status.meta } : null;
  const alert = status.alert === null ? quietStart : { ...status.alert, sound: 'default' };
  return {
    timestamp,
    event,
    'content-state': contentStateOf(status),
    ...(status.countdown === null ? {} : { 'stale-date': seconds(status.countdown.endsAt) }),
    ...(alert === null ? {} : { alert }),
    ...(event === 'start' ? { 'attributes-type': ATTRIBUTES_TYPE, attributes: {} } : {}),
  };
}

/** A waiting place's quiet move may wait for the phone's next wake; everything else goes at once. */
function priorityOf(event: ActivityEvent, status: LiveStatus | null): '5' | '10' {
  return event === 'update' && status?.kind === 'waiting' && status.alert === null ? '5' : '10';
}

/** Why Apple refused: a token it no longer knows is the phone's (or the Live Activity's) gone; our own key's trouble is not. */
function failureOf(status: number, reason: string, isActivity: boolean): LiveStatusFailure {
  const gone = status === 410 || (status === 400 && ['BadDeviceToken', 'DeviceTokenNotForTopic'].includes(reason));
  if (gone) return isActivity ? { code: 'activity_gone' } : { code: 'device_gone' };
  if (status === 429) return { code: 'rate_limited' };
  if (status === 403 && reason === 'ExpiredProviderToken') return { code: 'unavailable' };
  if (status >= 400 && status < 500) return { code: 'rejected', reason: `Apple answered ${status} ${reason}`.slice(0, 120) };
  return { code: 'unavailable' };
}

/** Which push a status is, and to which token: a running Live Activity's own, else the phone's push-to-start token. */
function routeOf(device: LiveStatusDevice, status: LiveStatus | null): { event: ActivityEvent; token: string } | null {
  if (device.activityToken !== null) return { event: status === null ? 'end' : 'update', token: device.activityToken };
  return status === null ? null : { event: 'start', token: device.token };
}

/** The provider token Apple takes, signed with the club's key and kept for most of its hour. */
function createProviderToken({ teamId, keyId, privateKey }: Pick<ApnsLiveActivityOptions, 'teamId' | 'keyId' | 'privateKey'>) {
  let signed: { readonly token: string; readonly at: number } | null = null;
  return {
    async at(now: Date): Promise<string> {
      if (signed !== null && now.getTime() - signed.at < TOKEN_LIFE_MS) return signed.token;
      const token = await signJwt({ algorithm: 'ES256', privateKey, header: { kid: keyId }, claims: { iss: teamId, iat: seconds(now) } });
      signed = { token, at: now.getTime() };
      return token;
    },
    drop() {
      signed = null;
    },
  };
}

/**
 * An iPhone's Live Activity through Apple's push service (decision 0323): started with the phone's push-to-start token
 * when none runs, then updated and ended through the Live Activity's own token. The phone counts down by itself to the
 * status's end, so a push goes only when the status changes. Signed with the club's push key (ES256).
 */
export function createApnsLiveActivity(options: ApnsLiveActivityOptions): LiveStatusAdapter {
  const { bundleId, environment, fetch = globalThis.fetch, now = () => new Date() } = options;
  const host = environment === 'production' ? 'https://api.push.apple.com' : 'https://api.sandbox.push.apple.com';
  const provider = createProviderToken(options);

  async function post(token: string, event: ActivityEvent, status: LiveStatus | null): Promise<Result<{ id: string }, LiveStatusFailure>> {
    const at = now();
    const answer = await fetch(`${host}/3/device/${token}`, {
      method: 'POST',
      headers: {
        authorization: `bearer ${await provider.at(at)}`,
        'apns-push-type': 'liveactivity',
        'apns-topic': `${bundleId}.push-type.liveactivity`,
        'apns-priority': priorityOf(event, status),
        'content-type': 'application/json',
      },
      body: JSON.stringify({ aps: apsOf(event, status, at) }),
      signal: AbortSignal.timeout(5_000),
    });
    if (answer.ok) return ok({ id: answer.headers.get('apns-id') ?? '' });
    const reason = replySchema.safeParse(await answer.json().catch(() => null)).data?.reason ?? '';
    if (reason === 'ExpiredProviderToken') provider.drop();
    // A start goes to the phone's push-to-start token; an update or an end to the Live Activity's own.
    return err(failureOf(answer.status, reason, event !== 'start'));
  }

  return {
    async show({ device, status }) {
      if (device.platform !== 'ios') return err({ code: 'rejected', reason: 'Apple sends to an iPhone only' });
      const route = routeOf(device, status);
      if (route === null) return ok({ id: '' });
      try {
        return await post(route.token, route.event, status);
      } catch {
        return err({ code: 'unavailable' });
      }
    },
  };
}
