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
/** A page of the website, by its slug, as `site_page.slug` allows it. */
const pageSlugSchema = z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/).max(60);
/** A link to another page of the website: `See every promotion`, `promotions`. */
const pageLinkSchema = z.object({ label: z.string().trim().min(1).max(40), page: pageSlugSchema });

/** A line above a heading, as `The RIVR difference`. */
const eyebrowSchema = z.string().trim().max(60).optional();

/** The club's own photos and video, served by the website from `apps/web/public/media` (decision 0118). */
const imageSchema = z.string().regex(/^\/media\/[a-z0-9-]+\.webp$/);
const videoSchema = z.string().regex(/^\/media\/[a-z0-9-]+\.mp4$/);

/** Said beside media that is not the room itself, as the teaser says it: `Concept visualisation`. */
const mediaNoteSchema = z.string().trim().max(40).optional();

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
      eyebrow: eyebrowSchema,
      heading: z.string().trim().min(1).max(80),
      text: z.string().trim().max(300).optional(),
      action: actionSchema.optional(),
      // A muted loop beside the heading, and its first frame, shown when motion is reduced (#441).
      video: z.object({ src: videoSchema, poster: imageSchema }).optional(),
      note: mediaNoteSchema,
    }),
  }),
  // A line or three set large across the page, as the manifesto or the last word before the footer.
  z.object({
    kind: z.literal('statement'),
    content: z.object({
      eyebrow: eyebrowSchema,
      lines: z.array(z.string().trim().min(1).max(60)).min(1).max(3),
      text: z.string().trim().max(300).optional(),
      action: actionSchema.optional(),
      image: imageSchema.optional(),
      note: mediaNoteSchema,
    }),
  }),
  // Photo tiles, each with a title and a line: the room and what the club does for its members.
  z.object({
    kind: z.literal('gallery'),
    content: z.object({
      eyebrow: eyebrowSchema,
      heading: headingSchema,
      intro: z.string().trim().max(300).optional(),
      items: z.array(z.object({
        image: imageSchema,
        alt: z.string().trim().min(1).max(160),
        title: z.string().trim().min(1).max(60),
        text: z.string().trim().max(160).optional(),
      })).min(2).max(8),
      note: mediaNoteSchema,
    }),
  }),
  // One picture beside its words, as the RIVR app.
  z.object({
    kind: z.literal('feature'),
    content: z.object({
      eyebrow: eyebrowSchema,
      heading: z.string().trim().min(1).max(80),
      text: z.string().trim().max(400).optional(),
      points: z.array(z.string().trim().min(1).max(40)).max(4).optional(),
      action: actionSchema.optional(),
      image: imageSchema,
      alt: z.string().trim().min(1).max(160),
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
      // How to reach the club, as the contact page lists them (decision 0166).
      phone: z.string().regex(/^\+91\d{10}$/).optional(),
      email: z.email().max(120).optional(),
    }),
  }),
  // Live blocks are placed, not typed: their rows come from the public views.
  z.object({ kind: z.literal('games'), content: z.object({ heading: headingSchema }) }),
  z.object({ kind: z.literal('calendar'), content: z.object({ heading: headingSchema }) }),
  // Large links into the player app, as a link-in-bio page leads with (#39).
  z.object({ kind: z.literal('links'), content: z.object({ heading: headingSchema, links: z.array(actionSchema).min(1).max(6) }) }),
  // The website's other bands, in grandpokerarena.com's way (decision 0166). The club's story: its words
  // beside a photo, with up to four figures.
  z.object({
    kind: z.literal('story'),
    content: z.object({
      eyebrow: eyebrowSchema,
      heading: z.string().trim().min(1).max(80),
      paragraphs: z.array(z.string().trim().min(1).max(600)).min(1).max(3),
      figures: z.array(z.object({ value: z.string().trim().min(1).max(12), label: z.string().trim().min(1).max(60) })).max(4).optional(),
      action: actionSchema.optional(),
      image: imageSchema.optional(),
      alt: z.string().trim().min(1).max(160).optional(),
    }).refine(({ image, alt }) => (image === undefined) === (alt === undefined), { path: ['alt'] }),
  }),
  // A grid of cards: what the club stands for, the room, its tiers, the steps to join, what's on, articles.
  z.object({
    kind: z.literal('cards'),
    content: z.object({
      eyebrow: eyebrowSchema,
      heading: headingSchema,
      intro: z.string().trim().max(400).optional(),
      cards: z.array(z.object({
        // A line above the title: `01`, `Tier I · 1× points`, `Play`.
        label: z.string().trim().min(1).max(40).optional(),
        title: z.string().trim().min(1).max(60),
        text: z.string().trim().max(300).optional(),
        points: z.array(z.string().trim().min(1).max(80)).max(6).optional(),
        link: pageLinkSchema.optional(),
      })).min(2).max(12),
      // A line set apart under the cards: `The only thing on your mind should be the next decision.`
      quote: z.string().trim().max(200).optional(),
      action: actionSchema.optional(),
    }),
  }),
  // Short phrases running across the page between bands: `Members only`, `Six tables`.
  z.object({ kind: z.literal('marquee'), content: z.object({ phrases: z.array(z.string().trim().min(1).max(40)).min(2).max(12) }) }),
  // Moments down a line: the club's story, or the law behind it.
  z.object({
    kind: z.literal('timeline'),
    content: z.object({
      eyebrow: eyebrowSchema,
      heading: headingSchema,
      intro: z.string().trim().max(400).optional(),
      items: z.array(z.object({
        when: z.string().trim().min(1).max(20),
        title: z.string().trim().min(1).max(100),
        text: z.string().trim().max(300).optional(),
      })).min(1).max(10),
    }),
  }),
  // A small table of figures, such as points by stake: every row as long as the columns.
  z.object({
    kind: z.literal('table'),
    content: z.object({
      heading: headingSchema,
      intro: z.string().trim().max(400).optional(),
      columns: z.array(z.string().trim().min(1).max(40)).min(2).max(4),
      rows: z.array(z.array(z.string().trim().min(1).max(60)).min(2).max(4)).min(1).max(20),
      note: z.string().trim().max(300).optional(),
    }).refine(({ columns, rows }) => rows.every((row) => row.length === columns.length), { path: ['rows'] }),
  }),
  // Live: the club's promotions, as their cards (public_promotion_cards).
  z.object({ kind: z.literal('promotions'), content: z.object({ heading: headingSchema }) }),
]);

/** A website block the website can show. */
export type SiteBlock = z.infer<typeof siteBlockSchema>;

/** The kinds of website block, as `site_block.kind` allows them. */
export const SITE_BLOCK_KINDS = siteBlockSchema.options.map((option) => option.shape.kind.value);

/** The website's pages a card may link to are its own: a slug, as `site_page.slug` allows it. */
export type SitePageLink = z.infer<typeof pageLinkSchema>;
