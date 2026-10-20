import type { Movement } from '@rivr/db';
import { t } from '@rivr/i18n';
import { Button, Divider, Heading, Inline, Money, Stack, Text, Time } from '@rivr/ui';
import { markerWords, movementTitle } from './movementCopy.ts';

/** A movement's amount: cash or bonus with its sign, gains in gold; a marker line in words. */
function Amount({ movement }: { movement: Movement }) {
  if (movement.account === 'receivable') return <Text variant="small">{markerWords(movement)}</Text>;
  return (
    <Inline gap={1} align="baseline">
      <Money paise={movement.amount} signed tone={movement.amount > 0n ? 'player' : 'default'} />
      {movement.account === 'bonus' ? <Text variant="small" tone="muted">{t('player.balance.bonusWord')}</Text> : null}
    </Inline>
  );
}

export interface MovementsSectionProps {
  movements: readonly Movement[];
  hasEarlier: boolean;
  isLoadingEarlier: boolean;
  onShowEarlier: () => void;
}

/**
 * Movements on Balance (#18): every money line on the member's accounts, newest first, each with its day,
 * what it was and where, and its amount; earlier ones on request.
 */
export function MovementsSection({ movements, hasEarlier, isLoadingEarlier, onShowEarlier }: MovementsSectionProps) {
  return (
    <Stack gap={3}>
      <Heading level={2}>{t('player.balance.movements')}</Heading>
      <Divider />
      {movements.length === 0 ? <Text tone="muted">{t('player.balance.empty')}</Text> : null}
      {movements.map((movement) => (
        <Stack key={movement.id} gap={3}>
          <Inline gap={4} justify="between">
            <Inline gap={4} grow>
              <Time at={new Date(movement.at)} show="day" size="small" tone="muted" />
              <Text>{movementTitle(movement)}</Text>
            </Inline>
            <Amount movement={movement} />
          </Inline>
          <Divider />
        </Stack>
      ))}
      {hasEarlier ? (
        <Button variant="text" isLoading={isLoadingEarlier} onClick={onShowEarlier}>{t('player.balance.showEarlier')}</Button>
      ) : null}
    </Stack>
  );
}
