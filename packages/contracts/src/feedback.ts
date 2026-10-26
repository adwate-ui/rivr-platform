import { z } from 'zod';

/** A member's rating of a visit (decision 0165): 1 to 5, and a note if they like, as the database checks it. */
export const visitRatingSchema = z.object({
  score: z.int().min(1).max(5),
  note: z.string().trim().max(1_000),
});

/** A note sent to the club from Profile: something, at most 1,000 characters. */
export const feedbackNoteSchema = z.object({ note: z.string().trim().min(1).max(1_000) });

/** What the General Manager did about a ticket: something, at most 500 characters. */
export const feedbackResolveSchema = z.object({ resolution: z.string().trim().min(1).max(500) });
