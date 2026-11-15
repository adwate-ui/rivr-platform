import type { SiteBlock } from '@rivr/contracts';
import type { SitePage as SitePageData, SiteRules } from '@rivr/db/site';
import { formatNumber, t } from '@rivr/i18n';
import { CardsBlock, TableBlock } from '@rivr/ui';

/** A rate in basis points as a percentage's figure: 500 is `5`, 250 is `2.5`. */
function percent(basisPoints: number): string {
  return formatNumber(basisPoints / 100);
}

/** The rakeback each table gives (#617), and how it is paid. A page with no rakeback set leaves the block out. */
function RewardsBlock({ heading, rules }: { heading: string | undefined; rules: SiteRules }) {
  return (
    <TableBlock heading={heading} columns={[t('web.rewards.table'), t('web.rewards.rakeback')]}
      rows={rules.rakebackBasisPoints.map((rule) => [rule.table, t('web.rewards.rakebackRate', { percent: percent(rule.value) })])}
      note={t('web.rewards.rakebackPaid')} />
  );
}

/** The cab the club gives (#617), from cab.minimum_visits. */
function OutstationBlock({ eyebrow, heading, rules }: { eyebrow: string | undefined; heading: string | undefined; rules: SiteRules }) {
  const cards = [
    ...(rules.cabVisits === null ? [] : [{ title: t('web.outstation.cab'), text: t('web.outstation.cabText', { visits: rules.cabVisits }) }]),
  ];
  return <CardsBlock eyebrow={eyebrow} heading={heading} cards={cards} />;
}

/** Whether a block read from the club's rules has nothing to show, so the page leaves its band out. */
export function isEmptyClubBlock(block: SiteBlock, rules: SiteRules): boolean {
  if (block.kind === 'rewards') return rules.rakebackBasisPoints.length === 0;
  if (block.kind === 'outstation') return rules.cabVisits === null;
  return false;
}

/** A block read from the club's rules in force (#617, decision 0283), never written into the page. */
export function ClubBlock({ block, page }: { block: Extract<SiteBlock, { kind: 'rewards' | 'outstation' }>; page: SitePageData }) {
  switch (block.kind) {
    case 'rewards':
      return <RewardsBlock heading={block.content.heading} rules={page.rules} />;
    case 'outstation':
      return <OutstationBlock eyebrow={block.content.eyebrow} heading={block.content.heading} rules={page.rules} />;
  }
}
