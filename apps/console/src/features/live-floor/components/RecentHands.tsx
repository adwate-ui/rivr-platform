import { useTableHands, type HandVariant } from '@rivr/db';
import { formatMoney, formatTime, t, type MessageKey } from '@rivr/i18n';
import { Button, ErrorMessage, Heading, Inline, Money, Stack, Text } from '@rivr/ui';

const VARIANT: Readonly<Record<HandVariant, MessageKey>> = {
  holdem: 'console.liveFloor.holdem',
  plo: 'console.liveFloor.plo',
  bomb_pot: 'console.liveFloor.bombPot',
};

/** The table's last hands tonight, as in the prototype: its number, when, the pot and game, and the rake (#81). */
export function RecentHands({ tableId }: { tableId: string }) {
  const hands = useTableHands(tableId);
  const title = <Heading level={3}>{t('console.liveFloor.recentHands')}</Heading>;
  if (hands.isError) {
    return (
      <Stack gap={2} align="start">
        {title}
        <ErrorMessage>{t('common.loadFailed')}</ErrorMessage>
        <Button onClick={() => void hands.refetch()}>{t('common.retry')}</Button>
      </Stack>
    );
  }
  return (
    <Stack gap={2}>
      {title}
      {hands.data === undefined ? <Text tone="muted">{t('common.loading')}</Text> : null}
      {hands.data?.length === 0 ? <Text tone="muted">{t('console.liveFloor.noHands')}</Text> : null}
      <Stack gap={2} divided>
        {(hands.data ?? []).map((hand) => (
          <Inline key={hand.handId} gap={4} justify="between" align="baseline">
            <Inline gap={4} align="baseline">
              <Text tone="muted">{t('console.liveFloor.handNumber', { number: hand.number })}</Text>
              <Text tone="muted">{formatTime(new Date(hand.playedAt))}</Text>
              <Text>{hand.pot === null ? t(VARIANT[hand.variant]) : t('console.liveFloor.handPot', { pot: formatMoney(hand.pot), variant: t(VARIANT[hand.variant]) })}</Text>
            </Inline>
            {hand.rake === null ? null : <Money paise={hand.rake} />}
          </Inline>
        ))}
      </Stack>
    </Stack>
  );
}
