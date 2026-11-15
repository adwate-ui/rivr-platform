import type { SiteBlock } from '@rivr/contracts';
import type { SitePage as SitePageData, SiteRules } from '@rivr/db/site';
import { formatChips, formatMoney, formatNumber, t } from '@rivr/i18n';
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

/** The rare hands that pay, from the best down, each with the bonus chips it pays (W-08); one that pays nothing is left out. */
function rareHands(highHands: NonNullable<SiteRules['highHands']>): string[] {
  const hands = [
    { name: t('web.jackpot.royalFlush'), paise: highHands.royalFlush }, { name: t('web.jackpot.straightFlush'), paise: highHands.straightFlush },
    { name: t('web.jackpot.fourOfAKind'), paise: highHands.fourOfAKind },
  ];
  return hands.flatMap((hand) => (hand.paise > 0n ? [t('web.jackpot.pays', { hand: hand.name, chips: formatChips(hand.paise) })] : []));
}

/** The Bad Beat Jackpot and the rare-hand bonuses (#618), from the live pool, jackpot.payout and high_hand.payouts. */
function JackpotBlock({ eyebrow, heading, rules, pool }: { eyebrow: string | undefined; heading: string | undefined; rules: SiteRules; pool: bigint | null }) {
  const { badBeat, highHands } = rules;
  const hands = highHands === null ? [] : rareHands(highHands);
  const cards = [
    ...(badBeat === null ? [] : [{
      title: t('web.jackpot.badBeat'),
      label: pool === null ? undefined : t('web.jackpot.pool', { amount: formatMoney(pool) }),
      text: t('web.jackpot.share', { percent: percent(badBeat.poolBasisPoints) }),
      points: [t('web.jackpot.loser', { percent: percent(badBeat.loserBasisPoints) }), t('web.jackpot.winner', { percent: percent(badBeat.winnerBasisPoints) }),
        t('web.jackpot.table', { percent: percent(badBeat.tableBasisPoints) })],
    }]),
    ...(hands.length === 0 ? [] : [{ title: t('web.jackpot.rareHands'), points: hands }]),
  ];
  return <CardsBlock eyebrow={eyebrow} heading={heading} cards={cards} />;
}

/** Whether a block read from the club's rules has nothing to show, so the page leaves its band out. */
export function isEmptyClubBlock(block: SiteBlock, rules: SiteRules): boolean {
  if (block.kind === 'rewards') return rules.rakebackBasisPoints.length === 0;
  if (block.kind === 'outstation') return rules.cabVisits === null;
  if (block.kind === 'jackpot') return rules.badBeat === null && (rules.highHands === null || rareHands(rules.highHands).length === 0);
  return false;
}

/** A block read from the club's rules in force (#617, #618, decision 0283), never written into the page. */
export function ClubBlock({ block, page }: { block: Extract<SiteBlock, { kind: 'rewards' | 'outstation' | 'jackpot' }>; page: SitePageData }) {
  switch (block.kind) {
    case 'rewards':
      return <RewardsBlock heading={block.content.heading} rules={page.rules} />;
    case 'outstation':
      return <OutstationBlock eyebrow={block.content.eyebrow} heading={block.content.heading} rules={page.rules} />;
    case 'jackpot':
      return <JackpotBlock eyebrow={block.content.eyebrow} heading={block.content.heading} rules={page.rules} pool={page.jackpotPool} />;
  }
}
