import { err, ok, type Result } from '@rivr/contracts/result';
import type { ClubEventKind } from '@rivr/contracts/clubEvents';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRivrData } from './provider.tsx';

// Kept here, not in queryKeys: this module is its own subpath (@rivr/db/clubEvents).
const keys = {
  venue: (userId: string, venueId: string) => ['user', userId, 'venue-club-events', venueId] as const,
  mine: (userId: string) => ['user', userId, 'my-club-events'] as const,
};

/** An event on the calendar (#143): a pro night or corporate table, when it starts, its seats and any details. */
export interface ClubEvent {
  readonly eventId: string;
  readonly kind: ClubEventKind;
  readonly title: string;
  readonly startsAt: string;
  readonly seats: number;
  readonly details: string | null;
}

/** An event as the console reads it, with how many have booked. */
export interface VenueClubEvent extends ClubEvent {
  readonly booked: number;
}

/** An event as a member reads it, with the seats left and whether they have booked. */
export interface MyClubEvent extends ClubEvent {
  readonly seatsLeft: number;
  readonly isBooked: boolean;
}

/** Why adding or booking an event was refused: the role or feature, out of bounds, started, full, a freeze, or anything else. */
export type ClubEventFailure = 'not_allowed' | 'invalid' | 'past' | 'full' | 'paused' | 'unavailable';
const FAILURE_BY_CODE: Readonly<Record<string, ClubEventFailure>> = { '42501': 'not_allowed', '22023': 'invalid', RVFRZ: 'paused', RVMBR: 'paused' };

/** What a refused change means: started or full from the hint, or the code's. */
function toFailure(error: { code: string; hint?: string | null }): ClubEventFailure {
  if (error.code === 'RVEVT') return error.hint === 'full' ? 'full' : 'past';
  return FAILURE_BY_CODE[error.code] ?? 'unavailable';
}

const toKind = (kind: string): ClubEventKind => (kind === 'corporate_table' ? 'corporate_table' : 'pro_night');

/** The venue's events from twelve hours ago on, with their bookings, for staff who run promotions. */
export function useVenueClubEvents(venueId: string) {
  const { client, userId } = useRivrData();
  return useQuery({
    queryKey: keys.venue(userId ?? 'signed-out', venueId),
    enabled: userId !== null,
    queryFn: async (): Promise<VenueClubEvent[]> => {
      const { data, error } = await client.rpc('venue_club_events', { p_venue_id: venueId });
      if (error) throw error;
      return data.map((row) => ({
        eventId: row.event_id, kind: toKind(row.kind), title: row.title, startsAt: row.starts_at, seats: row.seats, details: row.details, booked: row.booked,
      }));
    },
  });
}

/** Adds an event still to come; a Result, and the venue's events reload. */
export function useAddClubEvent(venueId: string) {
  const { client, userId } = useRivrData();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (event: { kind: ClubEventKind; title: string; startsAt: Date; seats: number; details: string }): Promise<Result<string, ClubEventFailure>> => {
      const { data, error } = await client.rpc('create_club_event', {
        p_venue_id: venueId, p_kind: event.kind, p_title: event.title, p_starts_at: event.startsAt.toISOString(), p_seats: event.seats, p_details: event.details,
      });
      await queryClient.invalidateQueries({ queryKey: keys.venue(userId ?? 'signed-out', venueId) });
      return error ? err(toFailure(error)) : ok(data);
    },
  });
}

/** The events still to come at the member's club (events.book). */
export function useMyClubEvents() {
  const { client, userId } = useRivrData();
  return useQuery({
    queryKey: keys.mine(userId ?? 'signed-out'),
    enabled: userId !== null,
    queryFn: async (): Promise<MyClubEvent[]> => {
      const { data, error } = await client.rpc('my_club_events');
      if (error) throw error;
      return data.map((row) => ({
        eventId: row.event_id, kind: toKind(row.kind), title: row.title, startsAt: row.starts_at, seats: row.seats, details: row.details,
        seatsLeft: row.seats_left, isBooked: row.is_booked,
      }));
    },
  });
}

/** The member books a seat at an event, or gives it back; a Result, and the events reload. */
export function useBookClubEvent() {
  const { client, userId } = useRivrData();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ eventId, isBooking }: { eventId: string; isBooking: boolean }): Promise<Result<null, ClubEventFailure>> => {
      const { error } = await client.rpc('book_club_event', { p_event_id: eventId, p_is_booking: isBooking });
      await queryClient.invalidateQueries({ queryKey: keys.mine(userId ?? 'signed-out') });
      return error ? err(toFailure(error)) : ok(null);
    },
  });
}
