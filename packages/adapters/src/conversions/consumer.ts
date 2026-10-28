import {
  err, idempotencyKeySchema, indianMobileSchema, memberIdSchema, ok, type IdempotencyKey, type IndianMobile, type MemberId, type Result,
} from '@rivr/contracts';
import { z } from 'zod';
import type { GoogleAdsConversionsAdapter } from '../google-ads/types.ts';
import type { MetaConversionsAdapter, MetaEventName } from '../meta-conversions/types.ts';
import type { Consumer } from '../outbox/index.ts';
import type { AdapterFailure } from '../shared/failure.ts';

/** The events that can be a conversion (#161, #162; scope-v1 "Growth", "Events sent"). */
export const CONVERSION_EVENT_TYPES = ['academy.booked', 'kyc.completed', 'visit.opened', 'cage.buy_in', 'tournament.entered'] as const;

/** What the club reports. The database says which one an event is, if any (conversion_for). */
export const CONVERSION_KINDS = ['academy_booking', 'kyc_complete', 'first_visit', 'first_buy_in', 'tournament_entry', 'repeat_visit'] as const;
export type ConversionKind = (typeof CONVERSION_KINDS)[number];

/** Whose conversion it is and which: each vendor's adapter hashes the identifiers before anything leaves. */
export interface ConversionSubject {
  readonly kind: ConversionKind;
  readonly memberId: MemberId;
  readonly phone: IndianMobile;
}

/** One conversion to report, with the outbox event's id: each vendor drops a second report with the same id. */
export interface Conversion extends ConversionSubject {
  readonly eventId: IdempotencyKey;
  readonly occurredAt: Date;
}

const subjectRows = z.array(z.object({ conversion: z.enum(CONVERSION_KINDS), member_id: memberIdSchema, phone: indianMobileSchema }));

/** conversion_for's answer: the event's conversion, or null when it reports nothing. */
export function conversionSubjectFrom(rows: unknown): ConversionSubject | null {
  const row = subjectRows.parse(rows)[0];
  return row === undefined ? null : { kind: row.conversion, memberId: row.member_id, phone: row.phone };
}

export type FindConversion = (venueId: string, eventType: string, payload: unknown) => Promise<ConversionSubject | null>;
export type ReportConversion = (conversion: Conversion) => Promise<Result<unknown, AdapterFailure>>;

/** Each conversion goes out within seven days of the event, Meta's window for physical-store events (scope-v1). */
const FRESH_FOR_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * An ad-conversions outbox consumer (#161, #162): each event the database names a conversion, reported to one vendor.
 * Not a messaging consumer, so a messaging stop does not hold it; practice-venue events never reach it. An event older
 * than seven days, or one that is not a conversion (no marketing consent, a later buy-in), is finished unsent.
 */
export function createConversionConsumer({ name, find, report, now = () => new Date() }: {
  name: string;
  find: FindConversion;
  report: ReportConversion;
  /** For tests; the clock by default. */
  now?: () => Date;
}): Consumer {
  return {
    name,
    eventTypes: CONVERSION_EVENT_TYPES,
    isMessaging: false,
    async deliver(delivery) {
      const occurredAt = delivery.occurredAt ?? now();
      if (now().getTime() - occurredAt.getTime() > FRESH_FOR_MS) return ok(null);
      const subject = await find(delivery.venueId, delivery.eventType, delivery.payload);
      if (subject === null) return ok(null);
      const eventId = idempotencyKeySchema.safeParse(delivery.eventId);
      if (!eventId.success) return err({ code: 'rejected', reason: 'the event id is not a UUID' });
      const reported = await report({ ...subject, eventId: eventId.data, occurredAt });
      return reported.ok ? ok(null) : reported;
    },
  };
}

const META_EVENT: Readonly<Record<ConversionKind, MetaEventName>> = {
  academy_booking: 'Schedule',
  kyc_complete: 'CompleteRegistration',
  first_visit: 'FirstVisit',
  first_buy_in: 'FirstBuyIn',
  tournament_entry: 'TournamentEntry',
  repeat_visit: 'RepeatVisit',
};

/** Reports each conversion to Meta, as its event. */
export function reportToMeta(meta: MetaConversionsAdapter): ReportConversion {
  return (conversion) => meta.send({
    eventId: conversion.eventId, eventName: META_EVENT[conversion.kind], eventTime: conversion.occurredAt, memberId: conversion.memberId,
    phone: conversion.phone,
  });
}

/** Google Ads' conversion action for each kind, as `customers/<id>/conversionActions/<id>`: one for every kind. */
export const conversionActionsSchema = z.record(z.enum(CONVERSION_KINDS), z.string().regex(/^customers\/\d+\/conversionActions\/\d+$/));
export type ConversionActions = z.infer<typeof conversionActionsSchema>;

/** Reports each conversion to Google Ads, under its kind's conversion action. Members arrive from a store, not a click. */
export function reportToGoogle(google: GoogleAdsConversionsAdapter, actions: ConversionActions): ReportConversion {
  return (conversion) => google.upload({
    orderId: conversion.eventId, conversionAction: actions[conversion.kind], conversionTime: conversion.occurredAt, gclid: null,
    phone: conversion.phone,
  });
}
