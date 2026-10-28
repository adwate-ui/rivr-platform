import type { IdempotencyKey, IndianMobile, MemberId, Result } from '@rivr/contracts';
import type { AdapterFailure } from '../shared/failure.ts';

/**
 * The events RIVR reports (#161): Meta's standard Schedule (an Academy booking) and CompleteRegistration (KYC complete),
 * and custom events for a first visit, a first buy-in, a tournament entry and a repeat visit.
 */
export type MetaEventName = 'Schedule' | 'CompleteRegistration' | 'FirstVisit' | 'FirstBuyIn' | 'TournamentEntry' | 'RepeatVisit';

/** A business event to report to Meta. The adapter hashes the identifiers before anything leaves. */
export interface MetaConversionEvent {
  /** Meta drops a second event with the same id. */
  readonly eventId: IdempotencyKey;
  readonly eventName: MetaEventName;
  readonly eventTime: Date;
  readonly memberId: MemberId;
  readonly phone: IndianMobile;
}

/** The event exactly as Meta receives it: hashed identifiers only, always from a physical store. */
export interface MetaServerEvent {
  readonly event_name: MetaEventName;
  /** Unix seconds. */
  readonly event_time: number;
  readonly event_id: string;
  readonly action_source: 'physical_store';
  readonly user_data: {
    readonly ph: readonly string[];
    readonly external_id: readonly string[];
    readonly country: readonly string[];
  };
}

/** The Meta Conversions API. The practice venue never reaches it (see `createAdapters`). */
export interface MetaConversionsAdapter {
  /** Sends one event. */
  send(event: MetaConversionEvent): Promise<Result<{ readonly eventsReceived: number }, AdapterFailure>>;
}
