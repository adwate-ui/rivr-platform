import { z } from 'zod';

/** Where a website link may hand a visitor to the player app, and the path there. */
export const PLAYER_DESTINATIONS = { 'sign-up': '/sign-in', academy: '/academy', waitlist: '/' } as const;

/** A destination in the player app a website block can link to. */
export type PlayerDestination = keyof typeof PLAYER_DESTINATIONS;

const actionSchema = z.object({
  label: z.string().trim().min(1).max(40),
  // Home is where a member joins a waitlist (#38).
  to: z.enum(['sign-up', 'academy', 'waitlist']),
});

const headingSchema = z.string().trim().max(80).optional();

/**
 * Directions only to a Google Maps page over HTTPS: a maps.app.goo.gl short link, or a /maps path on
 * Google, never Google's redirects or search, and never an address with a user name in it.
 */
const directionsSchema = z
  .url({ protocol: /^https$/, hostname: /^(www\.google\.com|maps\.google\.com|maps\.app\.goo\.gl)$/ })
  .refine((value) => {
    const url = new URL(value);
    const isMapsPage = url.hostname === 'maps.app.goo.gl' || url.pathname === '/maps' || url.pathname.startsWith('/maps/');
    return isMapsPage && url.username === '' && url.password === '';
  });

/**
 * One block of a website page, by kind, as `site_block.content` holds it (#9, #35). An optional field
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
    content: z.object({ heading: headingSchema, body: z.string().trim().min(1).max(4000) }),
  }),
  z.object({
    kind: z.literal('rules'),
    content: z.object({ heading: headingSchema, rules: z.array(z.string().trim().min(1).max(400)).min(1).max(40) }),
  }),
  z.object({
    kind: z.literal('faq'),
    content: z.object({
      heading: headingSchema,
      questions: z.array(z.object({ question: z.string().trim().min(1).max(200), answer: z.string().trim().min(1).max(1000) })).min(1).max(40),
    }),
  }),
  z.object({
    kind: z.literal('careers'),
    content: z.object({
      heading: headingSchema,
      roles: z.array(z.object({ title: z.string().trim().min(1).max(80), body: z.string().trim().min(1).max(600) })).max(20),
      apply: z.string().trim().max(300).optional(),
    }),
  }),
  z.object({
    kind: z.literal('map'),
    content: z.object({
      heading: headingSchema,
      address: z.string().trim().min(1).max(200),
      hours: z.string().trim().max(120).optional(),
      directionsUrl: directionsSchema,
    }),
  }),
  // Live blocks are placed, not typed: their rows come from the public views.
  z.object({ kind: z.literal('games'), content: z.object({ heading: headingSchema }) }),
  z.object({ kind: z.literal('calendar'), content: z.object({ heading: headingSchema }) }),
  // Large links into the player app, as a link-in-bio page leads with (#39).
  z.object({ kind: z.literal('links'), content: z.object({ heading: headingSchema, links: z.array(actionSchema).min(1).max(6) }) }),
]);

/** A website block the website can show. */
export type SiteBlock = z.infer<typeof siteBlockSchema>;

/** The kinds of website block, as `site_block.kind` allows them. */
export const SITE_BLOCK_KINDS = siteBlockSchema.options.map((option) => option.shape.kind.value);
