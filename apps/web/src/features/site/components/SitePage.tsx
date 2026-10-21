import type { Attribution, PlayerDestination, SiteBlock } from '@rivr/contracts';
import type { SitePage as SitePageData } from '@rivr/db/site';
import { t } from '@rivr/i18n';
import {
  CalendarBlock, CareersBlock, FaqBlock, FeatureBlock, GalleryBlock, GamesBlock, HeroBlock, LinksBlock, MapBlock, RulesBlock, StatementBlock,
  TextBlock, WebBand, WebFooter, WebShell, type WebBandTone,
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
    case 'map':
      return <MapBlock heading={block.content.heading} address={block.content.address} hours={block.content.hours} directionsUrl={block.content.directionsUrl} />;
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
      const { eyebrow, lines, text, action, image } = block.content;
      return <StatementBlock eyebrow={eyebrow} lines={lines} text={text} action={link(action)} image={image} />;
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

/** One block of a page, as its kind draws it; the live ones from the rows the page loaded. */
function Block({ block, page, link }: { block: SiteBlock; page: SitePageData; link: Link }) {
  switch (block.kind) {
    case 'hero':
    case 'statement':
    case 'gallery':
    case 'feature':
      return <MediaBlock block={block} link={link} />;
    case 'text':
      return <TextBlock heading={block.content.heading} body={block.content.body} />;
    case 'games':
      return <GamesBlock heading={block.content.heading} games={page.games} />;
    case 'calendar':
      return <CalendarBlock heading={block.content.heading} tournaments={page.tournaments} />;
    case 'links':
      return <LinksBlock heading={block.content.heading} links={block.content.links.map((action) => ({ label: action.label, href: link(action)?.href ?? '' }))} />;
    default:
      return <InfoBlock block={block} />;
  }
}

/** The footer every page carries: where the club is, how to reach it, and its 18+ line (#441). */
function Footer() {
  const links = [
    { label: t('web.footer.instagram'), href: 'https://www.instagram.com/rivr.pokerclub/' },
    { label: t('web.footer.email'), href: 'mailto:info@rivrpoker.com' },
  ];
  return <WebFooter address={t('web.footer.address')} notice={t('web.footer.notice')} links={links} />;
}

/** A page of the website: the navigation and its one action, the page's blocks in their bands, and the footer. */
export function SitePage({ page, playerUrl, attribution }: SitePageProps) {
  const links = page.navigation.map((link) => ({ label: link.title, href: siteHref(link.slug, attribution) }));
  const link: Link = (action) => (action ? { label: action.label, href: playerHref(playerUrl, action.to, attribution) } : undefined);
  const reserve = { label: t('web.reserve'), href: playerHref(playerUrl, 'waitlist', attribution) };
  return (
    <WebShell links={links} homeHref={siteHref('home', attribution)} action={reserve} footer={<Footer />}>
      {page.blocks.map((block, position) => (
        <WebBand key={`${String(position)}-${block.kind}`} tone={BAND[block.kind]}>
          <Block block={block} page={page} link={link} />
        </WebBand>
      ))}
    </WebShell>
  );
}
