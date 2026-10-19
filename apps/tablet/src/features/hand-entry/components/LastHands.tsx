import { useDownHands, useTabletHighHands, type DownHand, type TabletHighHand } from '@rivr/db';
import { formatTime, t } from '@rivr/i18n';
import { Button, ErrorMessage, Heading, Inline, Money, Stack, Text } from '@rivr/ui';
import { useState } from 'react';
import { claimStatusText, variantText } from './handCopy.ts';
import { HighHandForm } from './HighHandForm.tsx';

// The prototype lists the last few; the count above says how many the down has logged.
const SHOWN = 8;

/** One hand: when, the game and the pot; its high-hand claim, or a button to claim one. */
function HandRow({ hand, claim, onClaim }: { hand: DownHand; claim: TabletHighHand | undefined; onClaim: () => void }) {
  const time = formatTime(new Date(hand.playedAt));
  return (
    <Inline justify="between" align="center">
      <Stack gap={1}>
        <Text>{t('tablet.handEntry.hand', { time, variant: variantText(hand.variant) })}</Text>
        {claim === undefined ? null : <Text variant="small" tone="muted">{claimStatusText(claim.status)}</Text>}
      </Stack>
      <Inline gap={3} align="center">
        <Money paise={hand.pot} />
        {claim === undefined ? <Button variant="text" onClick={onClaim}>{t('tablet.highHand.claim', { time })}</Button> : null}
      </Inline>
    </Inline>
  );
}

/**
 * The down's hand count, and its last hands, latest first: when, the game and the pot. A high hand
 * is claimed from its hand's row (#47), and the row then says what the floor decided.
 */
export function LastHands({ downId }: { downId: string | null }) {
  const hands = useDownHands(downId);
  const claims = useTabletHighHands();
  const [claiming, setClaiming] = useState<string | null>(null);
  const [claimed, setClaimed] = useState<string | null>(null);
  if (hands.data === undefined && hands.isError) {
    return (
      <Stack gap={3} align="start">
        <ErrorMessage>{t('common.loadFailed')}</ErrorMessage>
        <Button onClick={() => void hands.refetch()}>{t('common.retry')}</Button>
      </Stack>
    );
  }
  if (hands.data === undefined) return <Text tone="muted">{t('common.loading')}</Text>;
  const claimOf = (handId: string) => claims.data?.find((claim) => claim.handId === handId);
  return (
    <Stack gap={4}>
      <Text variant="label">{t('tablet.handEntry.handsThisDown', { count: hands.data.length })}</Text>
      <Heading level={2}>{t('tablet.handEntry.lastHands')}</Heading>
      {claimed === null ? null : <Text>{claimed}</Text>}
      {hands.data.length === 0 ? <Text tone="muted">{t('tablet.handEntry.noHands')}</Text> : (
        <Stack gap={2} divided>
          {hands.data.slice(0, SHOWN).map((hand) => (
            <HandRow key={hand.handId} hand={hand} claim={claimOf(hand.handId)} onClaim={() => { setClaimed(null); setClaiming(hand.handId); }} />
          ))}
        </Stack>
      )}
      {claiming === null ? null : (
        <HighHandForm key={claiming} handId={claiming} onDone={(said) => { setClaiming(null); setClaimed(said); }} />
      )}
    </Stack>
  );
}
