import type { SiteBlock } from '@rivr/contracts';
import type { SitePage as SitePageData, SiteLeague, SiteRules, SiteStanding } from '@rivr/db/site';
import { formatMoney, formatMonth, formatNumber, t } from '@rivr/i18n';
import { CardsBlock, TableBlock, TextBlock } from '@rivr/ui';

/** A rate in basis points as a percentage's figure: 500 is `5`, 250 is `2.5`. */
function percent(basisPoints: number): string {
  return formatNumber(basisPoints / 100);
}

/** One League standing as a table shows it: a place, the name as the TVs show it, the points. */
function standingRows(standings: readonly SiteStanding[]): string[][] {
  return standings.map((standing) => [String(standing.place), standing.name ?? t('web.league.hidden'), formatNumber(standing.points)]);
}

/** The RIVR League (#617): this month's standings and this season's, each with its prizes from league.prizes. */
function LeagueBlock({ heading, league, rules }: { heading: string | undefined; league: SiteLeague; rules: SiteRules }) {
  const columns = [t('web.league.place'), t('web.league.member'), t('web.league.points')];
  const prizes = (words: string | null) => (words ? t('web.league.prizes', { prizes: words }) : undefined);
  const { month, season } = league;
  // Standings with none yet say so, with no empty table under them.
  const standings = (title: string | undefined, intro: string | undefined, rows: readonly SiteStanding[], words: string | null) => (rows.length > 0
    ? <TableBlock heading={title} intro={intro} columns={columns} rows={standingRows(rows)} note={prizes(words)} />
    : <TextBlock heading={title} body={[t('web.league.none'), prizes(words)].filter((line) => line !== undefined).join('\n\n')} />);
  return (
    <>
      {standings(heading, month ? t('web.league.monthIntro', { month: formatMonth(month.first) }) : undefined, month?.standings ?? [], rules.leaguePrizes.month)}
      {season ? standings(season.name, undefined, season.standings, rules.leaguePrizes.season) : null}
    </>
  );
}

/** What play earns by table (#617): points an hour and any rakeback, then RIVR Rewards and how time counts. */
function RewardsBlock({ heading, rules }: { heading: string | undefined; rules: SiteRules }) {
  const tables = [...new Set([...rules.pointsPerHour, ...rules.rakebackBasisPoints].map((rule) => rule.table))];
  const rowFor = (table: string) => {
    const points = rules.pointsPerHour.find((rule) => rule.table === table)?.value;
    const rakeback = rules.rakebackBasisPoints.find((rule) => rule.table === table)?.value;
    return [table, points === undefined ? t('web.rewards.none') : formatNumber(points),
      rakeback === undefined ? t('web.rewards.none') : t('web.rewards.rakebackRate', { percent: percent(rakeback) })];
  };
  const share = rules.rewardsRakeShareBasisPoints;
  const note = [
    t('web.rewards.rounding'),
    ...(rules.rakebackBasisPoints.length === 0 ? [] : [t('web.rewards.rakebackPaid')]),
    ...(share === null ? [] : [t('web.rewards.rakeShare', { percent: percent(share) })]),
  ].join(' ');
  return (
    <TableBlock heading={heading} intro={t('web.rewards.intro')} columns={[t('web.rewards.table'), t('web.rewards.points'), t('web.rewards.rakeback')]}
      rows={tables.map(rowFor)} note={note} />
  );
}

/** The cab and hotel nights the club gives (#617), from cab.minimum_visits and accommodation.hours_per_night. */
function OutstationBlock({ eyebrow, heading, rules }: { eyebrow: string | undefined; heading: string | undefined; rules: SiteRules }) {
  const cards = [
    ...(rules.cabVisits === null ? [] : [{ title: t('web.outstation.cab'), text: t('web.outstation.cabText', { visits: rules.cabVisits }) }]),
    ...(rules.hotelNightHours.length === 0 ? [] : [{
      title: t('web.outstation.hotel'),
      points: rules.hotelNightHours.map((rule) => t('web.outstation.hotelAt', { table: rule.table, hours: rule.value })),
    }]),
  ];
  return <CardsBlock eyebrow={eyebrow} heading={heading} cards={cards} />;
}

/** The rare hands that pay, from the best down, each with what it pays; one that pays nothing is left out. */
function rareHands(highHands: NonNullable<SiteRules['highHands']>): string[] {
  const hands = [
    { name: t('web.jackpot.royalFlush'), paise: highHands.royalFlush }, { name: t('web.jackpot.straightFlush'), paise: highHands.straightFlush },
    { name: t('web.jackpot.fourOfAKind'), paise: highHands.fourOfAKind },
  ];
  return hands.flatMap((hand) => (hand.paise > 0n ? [t('web.jackpot.pays', { hand: hand.name, amount: formatMoney(hand.paise) })] : []));
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
  if (block.kind === 'rewards') return rules.pointsPerHour.length === 0 && rules.rakebackBasisPoints.length === 0 && rules.rewardsRakeShareBasisPoints === null;
  if (block.kind === 'outstation') return rules.cabVisits === null && rules.hotelNightHours.length === 0;
  if (block.kind === 'jackpot') return rules.badBeat === null && (rules.highHands === null || rareHands(rules.highHands).length === 0);
  return false;
}

/** A block read from the League and the club's rules in force (#617, #618, decision 0283), never written into the page. */
export function ClubBlock({ block, page }: { block: Extract<SiteBlock, { kind: 'league' | 'rewards' | 'outstation' | 'jackpot' }>; page: SitePageData }) {
  switch (block.kind) {
    case 'league':
      return <LeagueBlock heading={block.content.heading} league={page.league} rules={page.rules} />;
    case 'rewards':
      return <RewardsBlock heading={block.content.heading} rules={page.rules} />;
    case 'outstation':
      return <OutstationBlock eyebrow={block.content.eyebrow} heading={block.content.heading} rules={page.rules} />;
    case 'jackpot':
      return <JackpotBlock eyebrow={block.content.eyebrow} heading={block.content.heading} rules={page.rules} pool={page.jackpotPool} />;
  }
}
