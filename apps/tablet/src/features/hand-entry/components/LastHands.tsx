import { useDownHands } from '@rivr/db';
import { formatTime, t } from '@rivr/i18n';
import { Button, ErrorMessage, Heading, Inline, Money, Stack, Text } from '@rivr/ui';
import { variantText } from './handCopy.ts';

// The prototype lists the last few; the count above says how many the down has logged.
const SHOWN = 8;

/** The down's hand count, and its last hands, latest first: when, the game and the pot. */
export function LastHands({ downId }: { downId: string | null }) {
  const hands = useDownHands(downId);
  if (hands.data === undefined && hands.isError) {
    return (
      <Stack gap={3} align="start">
        <ErrorMessage>{t('common.loadFailed')}</ErrorMessage>
        <Button onClick={() => void hands.refetch()}>{t('common.retry')}</Button>
      </Stack>
    );
  }
  if (hands.data === undefined) return <Text tone="muted">{t('common.loading')}</Text>;
  return (
    <Stack gap={4}>
      <Text variant="label">{t('tablet.handEntry.handsThisDown', { count: hands.data.length })}</Text>
      <Heading level={2}>{t('tablet.handEntry.lastHands')}</Heading>
      {hands.data.length === 0 ? <Text tone="muted">{t('tablet.handEntry.noHands')}</Text> : (
        <Stack gap={2} divided>
          {hands.data.slice(0, SHOWN).map((hand) => (
            <Inline key={hand.handId} justify="between">
              <Text>{t('tablet.handEntry.hand', { time: formatTime(new Date(hand.playedAt)), variant: variantText(hand.variant) })}</Text>
              <Money paise={hand.pot} />
            </Inline>
          ))}
        </Stack>
      )}
    </Stack>
  );
}
