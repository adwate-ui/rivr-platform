import { z } from 'zod';

/** Where a website link may hand a visitor to the player app, and the path there. */
export const PLAYER_DESTINATIONS = { 'sign-up': '/sign-in', academy: '/academy' } as const;

/** A destination in the player app a website block can link to. */
export type PlayerDestination = keyof typeof PLAYER_DESTINATIONS;

const actionSchema = z.object({
  label: z.string().trim().min(1).max(40),
  to: z.enum(['sign-up', 'academy']),
});

/**
 * One block of a website page, by kind, as `site_block.content` holds it (#9). C-019 adds kinds:
 * games and stakes, the tournament calendar, FAQ, map, house rules and the rest. An optional field
 * left blank is simply not shown; only a missing required one leaves the block out.
 */
export const siteBlockSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('hero'),
    content: z.object({
      heading: z.string().trim().min(1).max(80),
      text: z.string().trim().max(300).optional(),
      action: actionSchema.optional(),
    }),
  }),
  z.object({
    kind: z.literal('text'),
    content: z.object({
      heading: z.string().trim().max(80).optional(),
      body: z.string().trim().min(1).max(4000),
    }),
  }),
]);

/** A website block the website can show. */
export type SiteBlock = z.infer<typeof siteBlockSchema>;
