import { HIGH_HANDS, type CardRank, type HighHand } from '@rivr/contracts/promotionModel';
import { useLogHighHand, type FloorTable, type HighHandLive, type LogHighHandFailure, type SeatedPlayer } from '@rivr/db';
import { highHandPayout, ranksOf } from '@rivr/domain/promotions';
import { formatHandRank, formatHighHand, formatListedHand, formatNumber, t, type MessageKey } from '@rivr/i18n';
import { Box, Button, ChoiceChips, ErrorMessage, Sheet, Stack, Switch, Text, useToast } from '@rivr/ui';
import { useState } from 'react';

export interface HighHandSheetProps {
  venueId: string;
  /** The high hand that runs now: its hands, each with its Bonus, and its rules. */
  live: HighHandLive;
  tables: readonly FloorTable[];
  seats: readonly SeatedPlayer[];
  onClose: () => void;
}

// What a hand's rank is asked as: a straight flush's high card, which four, the three of a full house.
const RANK_LABEL: Partial<Record<HighHand, MessageKey>> = {
  straight_flush: 'console.floor.highHand.rank.straight_flush', four_of_a_kind: 'console.floor.highHand.rank.four_of_a_kind',
  full_house: 'console.floor.highHand.rank.full_house',
};

const NOTHING_CONFIRMED = { bothHoleCards: false, shownAtShowdown: false, playersDealt: false };

/** The hit as chosen so far: the table, a player seated at it, the hand and its rank, and each rule as the floor confirms it. */
function useHit() {
  const [tableId, setTableId] = useState<string | null>(null);
  const [memberId, setMemberId] = useState<string | null>(null);
  const [hand, setHand] = useState<HighHand | null>(null);
  const [rank, setRank] = useState<CardRank | null>(null);
  const [confirmed, setConfirmed] = useState(NOTHING_CONFIRMED);
  // A retry of the same hit is the same hit; a change makes it another (log_high_hand).
  const [requestId, setRequestId] = useState(() => crypto.randomUUID());
  const changed = () => setRequestId(crypto.randomUUID());
  return {
    tableId, memberId, hand, rank, confirmed, requestId,
    pickTable: (id: string | null) => { setTableId(id); setMemberId(null); changed(); },
    pickPlayer: (id: string | null) => { setMemberId(id); changed(); },
    pickHand: (next: HighHand | null) => { setHand(next); setRank(null); changed(); },
    pickRank: (next: CardRank | null) => { setRank(next); changed(); },
    confirm: (rule: keyof typeof NOTHING_CONFIRMED, isHeld: boolean) => setConfirmed((now) => ({ ...now, [rule]: isHeld })),
  };
}

type Hit = ReturnType<typeof useHit>;

/** Where and who: a table with players, then a player seated at it. */
function WhereAndWho({ hit, tables, seats }: { hit: Hit; tables: readonly FloorTable[]; seats: readonly SeatedPlayer[] }) {
  const played = tables.filter((table) => seats.some((seat) => seat.tableId === table.id));
  const players = seats.filter((seat) => seat.tableId === hit.tableId).sort((one, other) => one.seat - other.seat);
  return (
    <>
      <ChoiceChips look="subtle" mode="one" label={t('console.floor.highHand.table')} selected={hit.tableId === null ? [] : [hit.tableId]}
        options={played.map((table) => ({ value: table.id, label: table.name }))} onChange={([id]) => hit.pickTable(id ?? null)} />
      {hit.tableId === null ? null : (
        <ChoiceChips look="subtle" mode="one" label={t('console.floor.highHand.player')} selected={hit.memberId === null ? [] : [hit.memberId]}
          options={players.map((player) => ({ value: player.memberId, label: player.fullName }))} onChange={([id]) => hit.pickPlayer(id ?? null)} />
      )}
    </>
  );
}

/** The hand, from those the promotion lists, each with its Bonus; then its rank where the hand has one. */
function HandAndRank({ hit, live }: { hit: Hit; live: HighHandLive }) {
  const ranks = hit.hand === null ? [] : ranksOf(hit.hand);
  const rankLabel = hit.hand === null ? undefined : RANK_LABEL[hit.hand];
  const { hand } = hit;
  return (
    <>
      <ChoiceChips look="subtle" mode="one" label={t('console.floor.highHand.hand')} selected={hand === null ? [] : [hand]}
        options={live.reward.hands.map((listed) => ({
          value: listed.hand, label: t('console.floor.highHand.handChoice', { hand: formatListedHand(listed.hand), chips: formatNumber(listed.chips) }),
        }))}
        onChange={([picked]) => hit.pickHand(HIGH_HANDS.find((one) => one === picked) ?? null)} />
      {hand === null || rankLabel === undefined ? null : (
        <ChoiceChips look="subtle" mode="one" label={t(rankLabel)} selected={hit.rank === null ? [] : [hit.rank]}
          options={ranks.map((rank) => ({ value: rank, label: formatHandRank(hand, rank) }))}
          onChange={([picked]) => hit.pickRank(ranks.find((one) => one === picked) ?? null)} />
      )}
    </>
  );
}

/** Each rule the promotion holds, confirmed by the floor; the players dealt in always. */
function Rules({ hit, live }: { hit: Hit; live: HighHandLive }) {
  const { rules } = live.reward;
  return (
    <Stack gap={1}>
      {rules.bothHoleCards ? (
        <Switch label={t('console.floor.highHand.bothHoleCards')} isOn={hit.confirmed.bothHoleCards} onChange={(isOn) => hit.confirm('bothHoleCards', isOn)} />
      ) : null}
      {rules.shownAtShowdown ? (
        <Switch label={t('console.floor.highHand.shownAtShowdown')} isOn={hit.confirmed.shownAtShowdown} onChange={(isOn) => hit.confirm('shownAtShowdown', isOn)} />
      ) : null}
      <Switch label={t('console.floor.highHand.playersDealt', { count: rules.minPlayersDealt })} isOn={hit.confirmed.playersDealt}
        onChange={(isOn) => hit.confirm('playersDealt', isOn)} />
    </Stack>
  );
}

/** What Pay would pay, once the table, the player, the hand and each rule hold: the domain's rule, which the database decides again. */
function payableOf(hit: Hit, { live, tables, seats }: Pick<HighHandSheetProps, 'live' | 'tables' | 'seats'>) {
  const table = tables.find((one) => one.id === hit.tableId);
  const player = seats.find((seat) => seat.tableId === hit.tableId && seat.memberId === hit.memberId);
  if (table === undefined || player === undefined || hit.hand === null) return null;
  const payout = highHandPayout(live.reward, { hand: hit.hand, rank: hit.rank, confirmed: hit.confirmed });
  if (!payout.ok) return null;
  return {
    log: { tableId: table.id, memberId: player.memberId, hand: hit.hand, rank: hit.rank, confirmed: hit.confirmed, requestId: hit.requestId },
    words: { chips: formatNumber(payout.value.chips), name: player.fullName, hand: formatHighHand(payout.value.hand, payout.value.rank), table: table.name, seat: player.seat },
  };
}

function failureWords(failure: LogHighHandFailure): string {
  if (failure.reason === 'over_budget' && failure.left !== null) return t('console.floor.highHand.failures.over_budget', { left: formatNumber(failure.left) });
  return t(`console.floor.highHand.failures.${failure.reason === 'over_budget' ? 'unavailable' : failure.reason}`);
}

/**
 * Log a high hand (redesign RD-24): the table, a player seated at it, the hand and its rank, each rule confirmed; then the
 * line that says what will be paid, and Pay. It pays at once, and a toast names the player and the hand.
 */
export function HighHandSheet({ venueId, live, tables, seats, onClose }: HighHandSheetProps) {
  const hit = useHit();
  const log = useLogHighHand(venueId);
  const toast = useToast();
  const [failure, setFailure] = useState<LogHighHandFailure | null>(null);
  const payable = payableOf(hit, { live, tables, seats });
  const pay = async () => {
    if (payable === null || log.isPending) return;
    const done = await log.mutateAsync(payable.log);
    if (!done.ok) return setFailure(done.error);
    toast(t('console.floor.highHand.paid', payable.words));
    return onClose();
  };
  const footer = (
    <>
      <Button variant="text" onClick={onClose}>{t('console.floor.highHand.cancel')}</Button>
      <Button variant="primary" isDisabled={payable === null} isLoading={log.isPending} onClick={() => void pay()}>
        {payable === null ? t('console.floor.highHand.pay') : t('console.floor.highHand.payChips', { chips: payable.words.chips })}
      </Button>
    </>
  );
  return (
    <Sheet place="console" isOpen onClose={onClose} title={t('console.floor.highHand.log')} footer={footer}>
      <WhereAndWho hit={hit} tables={tables} seats={seats} />
      <HandAndRank hit={hit} live={live} />
      <Rules hit={hit} live={live} />
      {payable === null ? null : (
        <Box surface="raised" hairline="all" radius="lg" padding={4}><Text tone="accent" weight="medium">{t('console.floor.highHand.pays', payable.words)}</Text></Box>
      )}
      {failure === null ? null : <ErrorMessage>{failureWords(failure)}</ErrorMessage>}
    </Sheet>
  );
}
