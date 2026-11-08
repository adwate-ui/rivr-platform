import type { LiveStatusPlatform, Result } from '@rivr/contracts';
import type { AdapterFailure } from '../shared/failure.ts';

/** A member's phone in the native app (decision 0361). */
export interface LiveStatusDevice {
  readonly platform: LiveStatusPlatform;
  /** An Android phone's Firebase registration token, or an iPhone's ActivityKit push-to-start token. */
  readonly token: string;
  /** An iPhone's running Live Activity's own token, which its updates and its end go to; null while none runs. */
  readonly activityToken: string | null;
}

/** What the lock screen shows (decision 0323; the prototype's Lock screen states), in words already. */
export interface LiveStatus {
  readonly kind: 'waiting' | 'seat_ready' | 'seated';
  /** Top right: the game, `NLH 50/100`, or the seat, `Table 1, seat 4`. */
  readonly meta: string;
  /** Above the figure: `Waitlist · Table 1`, `Seat ready · held for`, `Call time left`. */
  readonly label: string;
  /** The figure in words, `Next in line`; null when the figure is the countdown. */
  readonly value: string | null;
  /** What the phone counts down from and to, and draws its bar by, on its own; null when nothing counts down. */
  readonly countdown: { readonly startsAt: Date; readonly endsAt: Date } | null;
  /** The one button: its words and the app path it opens, `/?accept=<place>` or `/fnb`. */
  readonly action: { readonly title: string; readonly url: string } | null;
  /** Sounds with this status, with these words where the phone shows them: the seat call. Null for a quiet change. */
  readonly alert: { readonly title: string; readonly body: string } | null;
}

/**
 * Why a status did not go: a vendor failure; a phone whose token the push service no longer knows (forget the phone);
 * or an iPhone's Live Activity that has ended, as its member swiped it away (start another).
 */
export type LiveStatusFailure = AdapterFailure | { readonly code: 'device_gone' } | { readonly code: 'activity_gone' };

/** What to show on one phone: a status, or null to end what it shows. */
export interface LiveStatusShow {
  readonly device: LiveStatusDevice;
  readonly status: LiveStatus | null;
}

/** The lock-screen live status: Apple's push service for an iPhone's Live Activity, Firebase for an Android phone's notification. */
export interface LiveStatusAdapter {
  /** Shows the status on the phone, or ends what it shows. */
  show(input: LiveStatusShow): Promise<Result<{ readonly id: string }, LiveStatusFailure>>;
}
