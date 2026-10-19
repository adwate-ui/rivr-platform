import type { Attribution, SiteBlock } from '@rivr/contracts';
import type { SitePage as SitePageData } from '@rivr/db/site';
import { CalendarBlock, CareersBlock, FaqBlock, GamesBlock, HeroBlock, MapBlock, RulesBlock, TextBlock, WebShell } from '@rivr/ui';
import { playerHref, siteHref } from '../links.ts';

interface SitePageProps {
  page: SitePageData;
  /** The player app's address. */
  playerUrl: string;
  /** The codes of the link the visitor arrived by, carried on every link. */
  attribution: Attribution | null;
}

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

/** One block of a page, as its kind draws it; the live ones from the rows the page loaded. */
function Block({ block, page, playerUrl, attribution }: { block: SiteBlock } & SitePageProps) {
  switch (block.kind) {
    case 'hero': {
      const { action } = block.content;
      const href = action ? playerHref(playerUrl, action.to, attribution) : undefined;
      return <HeroBlock heading={block.content.heading} text={block.content.text} action={action && href ? { label: action.label, href } : undefined} />;
    }
    case 'text':
      return <TextBlock heading={block.content.heading} body={block.content.body} />;
    case 'games':
      return <GamesBlock heading={block.content.heading} games={page.games} />;
    case 'calendar':
      return <CalendarBlock heading={block.content.heading} tournaments={page.tournaments} />;
    default:
      return <InfoBlock block={block} />;
  }
}

/** A page of the website: the navigation, and the page's blocks in order. */
export function SitePage({ page, playerUrl, attribution }: SitePageProps) {
  const links = page.navigation.map((link) => ({ label: link.title, href: siteHref(link.slug, attribution) }));
  return (
    <WebShell links={links} homeHref={siteHref('home', attribution)}>
      {page.blocks.map((block, position) => (
        <Block key={`${String(position)}-${block.kind}`} block={block} page={page} playerUrl={playerUrl} attribution={attribution} />
      ))}
    </WebShell>
  );
}
