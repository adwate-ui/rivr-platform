import { z } from 'zod';

/** A member's rating of a visit (decision 0165): 1 to 5, and a note if they like, as the database checks it. */
export const visitRatingSchema = z.object({
  score: z.int().min(1).max(5),
  note: z.string().trim().max(1_000),
});

/** A note sent to the club from Profile: something, at most 1,000 characters. */
export const feedbackNoteSchema = z.object({ note: z.string().trim().min(1).max(1_000) });

/** The quick form's topics (#637), as public.feedback.topic allows them. */
export const FEEDBACK_TOPICS = ['gameplay', 'dealer', 'check_in_out', 'app', 'service', 'ambience', 'cashier'] as const;
export type FeedbackTopic = (typeof FEEDBACK_TOPICS)[number];

/** The quick form (#637): one topic, and something said about it. */
export const quickFeedbackSchema = z.object({ topic: z.enum(FEEDBACK_TOPICS), note: z.string().trim().min(1).max(1_000) });

/** What the detailed form rates (#637), each 1 to 5. */
export const FEEDBACK_RATED = ['gameplay', 'cashier', 'service', 'ambience'] as const;
const rating = z.int().min(1).max(5);

/** The detailed form (#637): the four rated 1 to 5, the NPS question 0 to 10, and a note if the member likes. */
export const detailedFeedbackSchema = z.object({
  ratings: z.object({ gameplay: rating, cashier: rating, service: rating, ambience: rating }),
  nps: z.int().min(0).max(10),
  note: z.string().trim().max(1_000),
});

/** What the General Manager did about a ticket: something, at most 500 characters. */
export const feedbackResolveSchema = z.object({ resolution: z.string().trim().min(1).max(500) });
