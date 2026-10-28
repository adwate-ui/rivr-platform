import { z } from 'zod';

/** The events the club adds to the calendar (#143); Academy batches are listed beside them from the Academy. */
export const CLUB_EVENT_KINDS = ['pro_night', 'corporate_table'] as const;
export type ClubEventKind = (typeof CLUB_EVENT_KINDS)[number];

/** A new event as the console takes it: its kind and title, the IST day and time it starts, its seats and any details. */
export const newClubEventSchema = z.object({
  kind: z.enum(CLUB_EVENT_KINDS),
  title: z.string().trim().min(1).max(100),
  day: z.iso.date(),
  time: z.string().trim().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  seats: z.string().trim().regex(/^[1-9]\d{0,2}$/).transform(Number).pipe(z.int().min(1).max(500)),
  details: z.string().trim().max(500),
});
