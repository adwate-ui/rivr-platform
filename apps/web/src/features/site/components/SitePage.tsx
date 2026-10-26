import type { Attribution, PlayerDestination, SiteBlock } from '@rivr/contracts';
import type { SitePage as SitePageData } from '@rivr/db/site';
import { t } from '@rivr/i18n';
import {
  CalendarBlock, CardsBlock, CareersBlock, FaqBlock, FeatureBlock, GalleryBlock, GamesBlock, HeroBlock, LinksBlock, MapBlock, MarqueeBlock,
  PromotionsBlock, RulesBlock, StatementBlock, StoryBlock, TableBlock, TextBlock, TimelineBlock, WebBand, WebFooter, WebShell, type WebBandTone,
} from '@rivr/ui';
import { playerHref, siteHref } from '../links.ts';

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
  story: 'cream', cards: 'dark', marquee: 'deep', timeline: 'deep', table: 'cream', promotions: 'deep',
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
      return <MapBlock heading={heading} address={address} hours={hours} directionsUrl={directionsUrl} phone={phone} email={email} />;
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

/** A block of the club's own text, or one of its live rows: games, tournaments, promotions, or links into the app. */
function LiveBlock({ block, page, link }: { block: Extract<SiteBlock, { kind: 'text' | 'games' | 'calendar' | 'promotions' | 'links' }>; page: SitePageData; link: Link }) {
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
      return <LinksBlock heading={block.content.heading} links={block.content.links.map((action) => ({ label: action.label, href: link(action)?.href ?? '' }))} />;
  }
}

/** One block of a page, as its kind draws it; the live ones from the rows the page loaded. */
function Block({ block, page, link, pageLink }: { block: SiteBlock; page: SitePageData; link: Link; pageLink: PageLink }) {
  if (isKind(block, ['hero', 'statement', 'gallery', 'feature'])) return <MediaBlock block={block} link={link} />;
  if (isKind(block, ['story', 'cards', 'marquee', 'timeline', 'table'])) return <WordsBlock block={block} link={link} pageLink={pageLink} />;
  if (isKind(block, ['text', 'games', 'calendar', 'promotions', 'links'])) return <LiveBlock block={block} page={page} link={link} />;
  return <InfoBlock block={block} />;
}

// The pages the footer links to, as grandpokerarena.com's lists its policies (decision 0166).
const FOOTER_PAGES = [
  { slug: 'house-rules', label: 'web.footer.houseRules' }, { slug: 'questions', label: 'web.footer.questions' },
  { slug: 'responsible-play', label: 'web.footer.responsiblePlay' }, { slug: 'privacy', label: 'web.footer.privacy' },
  { slug: 'terms', label: 'web.footer.terms' },
] as const;

/** The footer every page carries: where the club is, its policies, how to reach it, and its 18+ line (#441). */
export function Footer({ attribution }: { attribution: Attribution | null }) {
  const links = [
    ...FOOTER_PAGES.map((page) => ({ label: t(page.label), href: siteHref(page.slug, attribution) })),
    { label: t('web.footer.instagram'), href: 'https://www.instagram.com/rivr.pokerclub/' },
    { label: t('web.footer.email'), href: 'mailto:info@rivrpoker.com' },
  ];
  return <WebFooter address={t('web.footer.address')} notice={t('web.footer.notice')} links={links} />;
}

/** A page of the website: the navigation and its one action, the page's blocks in their bands, and the footer. */
export function SitePage({ page, playerUrl, attribution }: SitePageProps) {
  const links = page.navigation.map((link) => ({ label: link.title, href: siteHref(link.slug, attribution) }));
  const link: Link = (action) => (action ? { label: action.label, href: playerHref(playerUrl, action.to, attribution) } : undefined);
  const pageLink: PageLink = (target) => (target ? { label: target.label, href: siteHref(target.page, attribution) } : undefined);
  const reserve = { label: t('web.reserve'), href: playerHref(playerUrl, 'waitlist', attribution) };
  return (
    <WebShell links={links} homeHref={siteHref('home', attribution)} action={reserve} footer={<Footer attribution={attribution} />}>
      {page.blocks.map((block, position) => (
        <WebBand key={`${String(position)}-${block.kind}`} tone={BAND[block.kind]}>
          <Block block={block} page={page} link={link} pageLink={pageLink} />
        </WebBand>
      ))}
    </WebShell>
  );
}
