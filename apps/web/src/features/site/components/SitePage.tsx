import type { Attribution, SiteBlock } from '@rivr/contracts';
import type { SitePage as SitePageData } from '@rivr/db/site';
import { CareersBlock, FaqBlock, HeroBlock, MapBlock, RulesBlock, TextBlock, WebShell } from '@rivr/ui';
import { playerHref, siteHref } from '../links.ts';

interface SitePageProps {
  page: SitePageData;
  /** The player app's address. */
  playerUrl: string;
  /** The codes of the link the visitor arrived by, carried on every link. */
  attribution: Attribution | null;
}

/** One block of a page, as its kind draws it. */
function Block({ block, playerUrl, attribution }: { block: SiteBlock } & Omit<SitePageProps, 'page'>) {
  switch (block.kind) {
    case 'hero': {
      const { action } = block.content;
      const href = action ? playerHref(playerUrl, action.to, attribution) : undefined;
      return <HeroBlock heading={block.content.heading} text={block.content.text} action={action && href ? { label: action.label, href } : undefined} />;
    }
    case 'text':
      return <TextBlock heading={block.content.heading} body={block.content.body} />;
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

/** A page of the website: the navigation, and the page's blocks in order. */
export function SitePage({ page, playerUrl, attribution }: SitePageProps) {
  const links = page.navigation.map((link) => ({ label: link.title, href: siteHref(link.slug, attribution) }));
  return (
    <WebShell links={links} homeHref={siteHref('home', attribution)}>
      {page.blocks.map((block, position) => (
        <Block key={`${String(position)}-${block.kind}`} block={block} playerUrl={playerUrl} attribution={attribution} />
      ))}
    </WebShell>
  );
}
