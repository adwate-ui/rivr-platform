import type { Attribution, PlayerDestination, SiteBlock } from '@rivr/contracts';
import type { SitePage as SitePageData } from '@rivr/db/site';
import { t, type MessageKey } from '@rivr/i18n';
import {
  CalendarBlock, CardsBlock, CareersBlock, CookieBanner, FaqBlock, FeatureBlock, GalleryBlock, GamesBlock, HeroBlock, KillSwitchBanner, LinksBlock, MapBlock,
  MarqueeBlock, PromotionsBlock, RulesBlock, StatementBlock, StoryBlock, TableBlock, TextBlock, TimelineBlock, WebBand, WebFooter, WebShell, type WebBandTone,
} from '@rivr/ui';
import { CLUB_CONTACT, playerHref, siteHref, whatsappHref } from '../links.ts';

interface SitePageProps {
  page: SitePageData;
  /** The player app's address. */
  playerUrl: string;
  /** The codes of the link the visitor arrived by, carried on every link. */
  attribution: Attribution | null;
}

/**
 * The band each kind of block sits in, so the front page alternates dark, deep green and cream as it reads,
 * as grandpokerarena.com's does (#441, decision 0118).
 */
const BAND: Record<SiteBlock['kind'], WebBandTone> = {
  hero: 'dark', statement: 'deep', gallery: 'cream', feature: 'dark', games: 'cream', calendar: 'deep', map: 'cream',
  text: 'deep', rules: 'deep', faq: 'cream', careers: 'deep', links: 'deep',
  // The bands added in decision 0166.
  story: 'cream', cards: 'dark', marquee: 'deep', timeline: 'deep', table: 'cream', promotions: 'deep', social_wall: 'cream',
};

type Link = (action: { label: string; to: PlayerDestination } | undefined) => { label: string; href: string } | undefined;

/** A block of the club's information: rules, questions, careers or how to find it. */
function InfoBlock({ block }: { block: Extract<SiteBlock, { kind: 'rules' | 'faq' | 'careers' | 'map' }> }) {
  switch (block.kind) {
    case 'rules':
      return <RulesBlock heading={block.content.heading} rules={block.content.rules} />;
    case 'faq':
      return <FaqBlock heading={block.content.heading} questions={block.content.questions} />;
    case 'careers':
      return <CareersBlock heading={block.content.heading} roles={block.content.roles} apply={block.content.apply} />;
    case 'map': {
      const { heading, address, hours, directionsUrl, phone, email } = block.content;
      // Google's embed of the address needs no key; it loads only once the visitor allows maps (#616).
      const embedUrl = `https://www.google.com/maps?q=${encodeURIComponent(address)}&output=embed`;
      return <MapBlock heading={heading} address={address} hours={hours} directionsUrl={directionsUrl} embedUrl={embedUrl} phone={phone} email={email} />;
    }
  }
}

type PageLink = (link: { label: string; page: string } | undefined) => { label: string; href: string } | undefined;

/** A band of the club's words in grandpokerarena.com's way (decision 0166): its story, cards, phrases, moments or a table. */
function WordsBlock({ block, link, pageLink }: { block: Extract<SiteBlock, { kind: 'story' | 'cards' | 'marquee' | 'timeline' | 'table' }>; link: Link; pageLink: PageLink }) {
  switch (block.kind) {
    case 'story': {
      const { eyebrow, heading, paragraphs, figures, action, image, alt } = block.content;
      return <StoryBlock eyebrow={eyebrow} heading={heading} paragraphs={paragraphs} figures={figures} action={link(action)} image={image} alt={alt} />;
    }
    case 'cards': {
      const { eyebrow, heading, intro, cards, quote, action } = block.content;
      return <CardsBlock eyebrow={eyebrow} heading={heading} intro={intro} quote={quote} action={link(action)}
        cards={cards.map((card) => ({ ...card, link: pageLink(card.link) }))} />;
    }
    case 'marquee':
      return <MarqueeBlock phrases={block.content.phrases} />;
    case 'timeline':
      return <TimelineBlock eyebrow={block.content.eyebrow} heading={block.content.heading} intro={block.content.intro} items={block.content.items} />;
    case 'table': {
      const { heading, intro, columns, rows, note } = block.content;
      return <TableBlock heading={heading} intro={intro} columns={columns} rows={rows} note={note} />;
    }
  }
}

/** A block of the club's own pictures and words: the hero, a statement, a gallery or a feature (#441). */
function MediaBlock({ block, link }: { block: Extract<SiteBlock, { kind: 'hero' | 'statement' | 'gallery' | 'feature' }>; link: Link }) {
  switch (block.kind) {
    case 'hero': {
      const { eyebrow, heading, text, action, video, note } = block.content;
      return <HeroBlock eyebrow={eyebrow} heading={heading} text={text} action={link(action)} video={video} note={note} />;
    }
    case 'statement': {
      const { eyebrow, lines, text, action, image, note } = block.content;
      return <StatementBlock eyebrow={eyebrow} lines={lines} text={text} action={link(action)} image={image} note={note} />;
    }
    case 'gallery': {
      const { eyebrow, heading, intro, items, note } = block.content;
      return <GalleryBlock eyebrow={eyebrow} heading={heading} intro={intro} items={items} note={note} />;
    }
    case 'feature': {
      const { eyebrow, heading, text, points, action, image, alt } = block.content;
      return <FeatureBlock eyebrow={eyebrow} heading={heading} text={text} points={points} action={link(action)} image={image} alt={alt} />;
    }
  }
}

/** Whether a block is one of these kinds. */
function isKind<K extends SiteBlock['kind']>(block: SiteBlock, kinds: readonly K[]): block is Extract<SiteBlock, { kind: K }> {
  return kinds.some((kind) => kind === block.kind);
}

// A wall post's caption on the website, at most as long as a card's text.
const WALL_CAPTION = 300;

/** A block of the club's own text, or one of its live rows: games, tournaments, promotions, links into the app, or the social wall. */
function LiveBlock({ block, page, link }: { block: Extract<SiteBlock, { kind: 'text' | 'games' | 'calendar' | 'promotions' | 'links' | 'social_wall' }>; page: SitePageData; link: Link }) {
  switch (block.kind) {
    case 'text':
      return <TextBlock heading={block.content.heading} body={block.content.body} />;
    case 'games':
      return <GamesBlock heading={block.content.heading} games={page.games} />;
    case 'calendar':
      return <CalendarBlock heading={block.content.heading} tournaments={page.tournaments} />;
    case 'promotions':
      return <PromotionsBlock heading={block.content.heading} emptyText={t('web.noPromotions')}
        promotions={page.promotions.map((promotion) => ({ title: promotion.title, detail: promotion.detail ?? undefined, runs: promotion.runs ?? undefined }))} />;
    case 'links':
      return <LinksBlock heading={block.content.heading} links={block.content.links.flatMap((action) => link(action) ?? [])} />;
    case 'social_wall':
      // The club's approved Instagram posts (#157).
      return (
        <CardsBlock heading={block.content.heading} cards={page.wallPosts.map((post) => ({
          title: t('web.wallHandle', { handle: post.handle }), text: post.caption.slice(0, WALL_CAPTION), link: { label: t('web.wallOpen'), href: post.permalink },
        }))} />
      );
  }
}

/** One block of a page, as its kind draws it; the live ones from the rows the page loaded. */
function Block({ block, page, link, pageLink }: { block: SiteBlock; page: SitePageData; link: Link; pageLink: PageLink }) {
  if (isKind(block, ['hero', 'statement', 'gallery', 'feature'])) return <MediaBlock block={block} link={link} />;
  if (isKind(block, ['story', 'cards', 'marquee', 'timeline', 'table'])) return <WordsBlock block={block} link={link} pageLink={pageLink} />;
  if (isKind(block, ['text', 'games', 'calendar', 'promotions', 'links', 'social_wall'])) return <LiveBlock block={block} page={page} link={link} />;
  return <InfoBlock block={block} />;
}

/** A link to a page of the website, or to one of its bands by the band's anchor. */
interface SiteLink {
  readonly label: MessageKey;
  readonly page: string;
  readonly anchor?: string;
}

// The header's menu in grandpokerarena.com's order (#616, decision 0283): pages, and the front page's bands by their
// anchors. RIVR Academy stays out of it until the Academy is ready.
const MENU: readonly SiteLink[] = [
  { label: 'web.menu.club', page: 'about' }, { label: 'web.menu.room', page: 'home', anchor: 'the-room' },
  { label: 'web.menu.games', page: 'home', anchor: 'games' }, { label: 'web.menu.membership', page: 'membership' },
  { label: 'web.menu.leaderboard', page: 'leaderboard' }, { label: 'web.menu.whatsOn', page: 'tournaments' },
  { label: 'web.menu.prizes', page: 'promotions' }, { label: 'web.menu.journal', page: 'journal' },
  { label: 'web.menu.visit', page: 'visit' },
];

// The footer's columns, as grandpokerarena.com's has them (#616); its policies as decision 0166 listed them.
const FOOTER_CLUB: readonly SiteLink[] = [
  { label: 'web.footer.story', page: 'about' }, { label: 'web.footer.room', page: 'home', anchor: 'the-room' },
  { label: 'web.footer.membership', page: 'membership' }, { label: 'web.footer.standard', page: 'home', anchor: 'the-standard' },
];
const FOOTER_PLAY: readonly SiteLink[] = [
  { label: 'web.footer.games', page: 'home', anchor: 'games' }, { label: 'web.footer.leaderboard', page: 'leaderboard' },
  { label: 'web.footer.tournaments', page: 'tournaments' }, { label: 'web.footer.promotions', page: 'promotions' },
];
const FOOTER_POLICIES: readonly SiteLink[] = [
  { label: 'web.footer.houseRules', page: 'house-rules' }, { label: 'web.footer.legal', page: 'about', anchor: 'legal-and-compliance' },
  { label: 'web.footer.responsiblePlay', page: 'responsible-play' }, { label: 'web.footer.questions', page: 'questions' },
  { label: 'web.footer.privacy', page: 'privacy' }, { label: 'web.footer.terms', page: 'terms' },
];

/** The footer every page carries: where the club is, its columns of links, the helplines, its 18+ line and copyright (#441, #616). */
export function Footer({ attribution, playerUrl }: { attribution: Attribution | null; playerUrl: string }) {
  const links = (column: readonly SiteLink[]) => column.map((link) => ({ label: t(link.label), href: siteHref(link.page, attribution, link.anchor) }));
  const columns = [
    { heading: t('web.footer.club'), links: links(FOOTER_CLUB) },
    { heading: t('web.footer.play'), links: [...links(FOOTER_PLAY), { label: t('web.footer.app'), href: playerHref(playerUrl, 'waitlist', attribution) }] },
    { heading: t('web.footer.policies'), links: links(FOOTER_POLICIES) },
    { heading: t('web.footer.helplines'), links: [{ label: t('web.footer.teleManas'), href: 'tel:14416' }, { label: t('web.footer.iCall'), href: 'tel:+919152987821' }] },
  ];
  return (
    <WebFooter address={t('web.footer.address')} notice={t('web.footer.notice')} columns={columns} copyright={t('web.footer.copyright')}
      cookieSettings={t('web.footer.cookieSettings')} />
  );
}

/** The bar above the header: the club's number, WhatsApp and socials, and the member app (#616). */
function topBar(playerUrl: string, attribution: Attribution | null) {
  return {
    links: [
      { label: t('web.top.phone'), href: `tel:${CLUB_CONTACT.phone}` }, { label: t('web.top.whatsapp'), href: whatsappHref() },
      { label: t('web.top.instagram'), href: CLUB_CONTACT.instagram }, { label: t('web.top.youtube'), href: CLUB_CONTACT.youtube },
      { label: t('web.top.email'), href: `mailto:${CLUB_CONTACT.email}` },
    ],
    app: { label: t('web.top.app'), href: playerHref(playerUrl, 'waitlist', attribution) },
  };
}

/** `The room` as an anchor: `the-room`. */
function anchorFrom(words: string): string {
  return words.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

/**
 * Each block's anchor (#616): from its eyebrow, or its kind for one without, so the menu can lead to the front page's
 * The room or Games. The first block to claim an anchor has it.
 */
function anchorsOf(blocks: readonly SiteBlock[]): (string | undefined)[] {
  const taken = new Set<string>();
  return blocks.map((block) => {
    const eyebrow = 'eyebrow' in block.content ? block.content.eyebrow : undefined;
    const anchor = anchorFrom(eyebrow ?? block.kind);
    if (anchor === '' || taken.has(anchor)) return undefined;
    taken.add(anchor);
    return anchor;
  });
}

/** A page of the website: the navigation and its one action, the page's blocks in their bands, and the footer. */
export function SitePage({ page, playerUrl, attribution }: SitePageProps) {
  const links = MENU.map((item) => ({ label: t(item.label), href: siteHref(item.page, attribution, item.anchor) }));
  // While the club is paused (#278) nothing leads to the waitlist: seating is refused.
  const link: Link = (action) => (action && !(page.isPaused && action.to === 'waitlist')
    ? { label: action.label, href: playerHref(playerUrl, action.to, attribution) } : undefined);
  const pageLink: PageLink = (target) => (target ? { label: target.label, href: siteHref(target.page, attribution) } : undefined);
  const reserve = { label: t('web.reserve'), href: whatsappHref(t('web.reserveMessage')) };
  // A social wall with no approved posts yet is left out, band and all.
  const blocks = page.blocks.filter((block) => block.kind !== 'social_wall' || page.wallPosts.length > 0);
  const anchors = anchorsOf(blocks);
  return (
    <WebShell links={links} homeHref={siteHref('home', attribution)} action={page.isPaused ? undefined : reserve} topBar={topBar(playerUrl, attribution)}
      footer={<Footer attribution={attribution} playerUrl={playerUrl} />} after={<CookieBanner />}>
      {page.isPaused ? <KillSwitchBanner audience="visitor" /> : null}
      {blocks.map((block, position) => (
        <WebBand key={`${String(position)}-${block.kind}`} tone={BAND[block.kind]} anchor={anchors[position]}
          live={block.kind === 'games' ? `games-${String(position)}` : undefined}>
          <Block block={block} page={page} link={link} pageLink={pageLink} />
        </WebBand>
      ))}
    </WebShell>
  );
}
