import { describeScenario, handHistory, legalActions, PAD_SIZINGS, takesSizing, type Action, type Card, type Position, type SizingBucket } from '@rivr/drills';
import { t } from '@rivr/i18n';
import { Button, ChoiceChips, DrillTable, Heading, Stack, Text, type DrillSeat } from '@rivr/ui';
import { useState } from 'react';
import type { PadAnswer, Spot } from '../drill.ts';

const SEATS: readonly Position[] = ['UTG', 'UTG1', 'UTG2', 'LJ', 'HJ', 'CO', 'BTN', 'SB', 'BB'];
const SUIT_GLYPH = { s: '\u2660', h: '\u2665', d: '\u2666', c: '\u2663' } as const;
const bb = (amount: number) => t('player.learn.spot.bb', { amount: String(amount) });

/** A card as the felt shows it: "10♠". */
export const cardLabel = (card: Card) => `${card.rank === 'T' ? '10' : card.rank}${SUIT_GLYPH[card.suit]}`;

/** The nine seats as the hand stands: plates, who is in, and the bets in front. */
function seatsOf(spot: Spot): DrillSeat[] {
  const history = handHistory(spot.scenario);
  return SEATS.map((position) => {
    const state = history.roles.get(position) ?? 'folded';
    const bet = history.bets[position];
    const plate = state === 'hero' ? `${t('player.learn.spot.you')} · ${position}` : state === 'in_pot' ? `${history.labels[position]} · ${position}` : position;
    return { plate, state, bet: bet === undefined ? null : bb(bet) };
  });
}

/** The answer pad (#133): Fold, Call or Raise (or Check and Bet), then how much where it takes a size, then Answer. */
function AnswerPad({ spot, onAnswer }: { spot: Spot; onAnswer: (answer: PadAnswer) => void }) {
  const [action, setAction] = useState<Action | null>(null);
  const [sizing, setSizing] = useState<SizingBucket | null>(null);
  const needsSize = action !== null && takesSizing(action);
  return (
    <Stack gap={3}>
      <ChoiceChips label={t('player.learn.spot.action')} mode="one" selected={action === null ? [] : [action]}
        options={legalActions(spot.scenario).map((value) => ({ value, label: t(`player.learn.actions.${value}`) }))}
        onChange={(chosen) => { setAction(chosen[0] ?? null); setSizing(null); }} />
      {needsSize ? (
        <ChoiceChips label={t('player.learn.spot.size')} mode="one" selected={sizing === null ? [] : [sizing]}
          options={PAD_SIZINGS.map((value) => ({ value, label: t(`player.learn.sizes.${value}`) }))} onChange={(chosen) => setSizing(chosen[0] ?? null)} />
      ) : null}
      <Button variant="primary" isDisabled={action === null || (needsSize && sizing === null)}
        onClick={() => { if (action !== null) onAnswer({ action, sizing: needsSize ? (sizing ?? undefined) : undefined }); }}>
        {t('player.learn.spot.answer')}
      </Button>
    </Stack>
  );
}

/** One spot (#133): the table drawing, the spot in words for screen readers, the action so far, and the pad. */
export function SpotView({ spot, onAnswer }: { spot: Spot; onAnswer: (answer: PadAnswer) => void }) {
  const history = handHistory(spot.scenario);
  const { rows } = history;
  return (
    <Stack gap={4}>
      <DrillTable seats={seatsOf(spot)} board={spot.scenario.board.map(cardLabel)} hole={spot.scenario.hole.map(cardLabel)}
        pot={history.potBb === undefined ? null : t('player.learn.spot.pot', { amount: String(history.potBb) })} />
      <Text variant="small" tone="muted">{describeScenario(spot.scenario, bb)}</Text>
      <Stack gap={1}>
        <Heading level={2}>{t('player.learn.spot.history')}</Heading>
        {rows.length === 0 ? <Text tone="muted">{t('player.learn.spot.noHistory')}</Text> : rows.map((row, index) => (
          <Text key={`${row.street}-${String(index)}`} variant="small">
            {`${row.seat ?? ''} ${row.action}${row.amountBb === undefined ? '' : ` ${bb(row.amountBb)}`}`.trim()}
          </Text>
        ))}
      </Stack>
      <AnswerPad key={spot.scenario.seed} spot={spot} onAnswer={onAnswer} />
    </Stack>
  );
}
