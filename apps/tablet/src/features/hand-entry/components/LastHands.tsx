import { useDownHands, useHandQueue, useTabletHighHands, type DownHand, type QueuedHand, type TabletHighHand } from '@rivr/db';
import { formatTime, t } from '@rivr/i18n';
import { Button, ErrorMessage, Heading, Inline, Money, Stack, Text } from '@rivr/ui';
import { claimStatusText, variantText } from './handCopy.ts';

// The prototype lists the last few; the count above says how many the down has logged.
const SHOWN = 8;

/** One hand: when, the game and the pot, and what the floor made of its high-hand claim. */
function HandRow({ hand, claim }: { hand: DownHand; claim: TabletHighHand | undefined }) {
  return (
    <Inline justify="between" align="center">
      <Stack gap={1}>
        <Text>{t('tablet.handEntry.hand', { time: formatTime(new Date(hand.playedAt)), variant: variantText(hand.variant) })}</Text>
        {claim === undefined ? null : <Text variant="small" tone="muted">{claimStatusText(claim.status)}</Text>}
        {claim?.isCorrected ? <Text variant="small" tone="muted">{t('tablet.highHand.corrected')}</Text> : null}
      </Stack>
      <Money paise={hand.pot} />
    </Inline>
  );
}

/** A hand still on the tablet, waiting to reach the database (#43): marked queued, as in the prototype. */
function QueuedRow({ hand }: { hand: QueuedHand }) {
  return (
    <Inline justify="between" align="center">
      <Text>{t('tablet.handEntry.queuedHand', { time: formatTime(new Date(hand.playedAt)), variant: variantText(hand.variant) })}</Text>
      <Money paise={hand.pot} />
    </Inline>
  );
}

/** The down's hand count, and its last hands, latest first: when, the game, the pot and any high-hand claim (#47). Hands still queued on the tablet count and show first (#43). */
export function LastHands({ downId }: { downId: string | null }) {
  const hands = useDownHands(downId);
  const claims = useTabletHighHands();
  const { queued } = useHandQueue();
  if (hands.data === undefined && hands.isError) {
    return (
      <Stack gap={3} align="start">
        <ErrorMessage>{t('common.loadFailed')}</ErrorMessage>
        <Button onClick={() => void hands.refetch()}>{t('common.retry')}</Button>
      </Stack>
    );
  }
  if (hands.data === undefined) return <Text tone="muted">{t('common.loading')}</Text>;
  const waiting = queued.toReversed().slice(0, SHOWN);
  return (
    <Stack gap={4}>
      <Text variant="label">{t('tablet.handEntry.handsThisDown', { count: hands.data.length + queued.length })}</Text>
      <Heading level={2}>{t('tablet.handEntry.lastHands')}</Heading>
      {hands.data.length + queued.length === 0 ? <Text tone="muted">{t('tablet.handEntry.noHands')}</Text> : (
        <Stack gap={2} divided>
          {waiting.map((hand) => <QueuedRow key={`queued-${hand.playedAt}`} hand={hand} />)}
          {hands.data.slice(0, SHOWN - waiting.length).map((hand) => (
            <HandRow key={hand.handId} hand={hand} claim={claims.data?.find((claim) => claim.handId === hand.handId)} />
          ))}
        </Stack>
      )}
    </Stack>
  );
}
