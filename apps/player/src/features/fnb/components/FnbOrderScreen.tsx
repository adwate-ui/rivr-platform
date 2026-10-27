import { useFeature, useMySeat } from '@rivr/db';
import { useMyFnbMenu, usePlaceFnbOrder, type FnbFailure } from '@rivr/db/fnb';
import { t } from '@rivr/i18n';
import { Button, ErrorMessage, FeatureGate, LoadState, QuantityStepper, Screen, Stack, StatusMessage, Text } from '@rivr/ui';
import { useState } from 'react';

/**
 * Table-side food and drink (#123; feature fnb.table_side): the member's menu (alcohol only at 21 or over), how many of
 * each, and Send to the bar. The order goes to their seat's visit, paid to Glaza when it comes, with a KOT at the bar.
 */
export function FnbOrderScreen() {
  const access = useFeature('fnb.table_side');
  return (
    <Screen title={t('player.fnb.title')}>
      <FeatureGate access={access}><FnbOrder /></FeatureGate>
    </Screen>
  );
}

function FnbOrder() {
  const seat = useMySeat().data ?? null;
  const menu = useMyFnbMenu();
  const place = usePlaceFnbOrder();
  const [counts, setCounts] = useState<Readonly<Record<string, number>>>({});
  const [sent, setSent] = useState<number | null>(null);
  const [failure, setFailure] = useState<FnbFailure | null>(null);
  if (seat === null) return <Text>{t('player.fnb.notSeated')}</Text>;
  if (menu.data === undefined) return <LoadState isError={menu.isError} onRetry={() => void menu.refetch()} />;
  if (menu.data.length === 0) return <Text>{t('player.fnb.empty')}</Text>;
  const lines = Object.entries(counts).filter(([, quantity]) => quantity > 0).map(([itemId, quantity]) => ({ item_id: itemId, quantity }));
  const send = async () => {
    const outcome = await place.mutateAsync(lines);
    setFailure(outcome.ok ? null : outcome.error);
    setSent(outcome.ok ? outcome.value.kotNumber : null);
    if (outcome.ok) setCounts({});
  };
  return (
    <Stack gap={4}>
      <Stack gap={3}>
        {menu.data.map((item) => (
          <QuantityStepper key={item.itemId} label={item.name} value={counts[item.itemId] ?? 0}
            onChange={(quantity) => { setCounts({ ...counts, [item.itemId]: quantity }); setSent(null); }} />
        ))}
      </Stack>
      <Text variant="small" tone="muted">{t('player.fnb.paid')}</Text>
      <Button variant="primary" isDisabled={lines.length === 0} isLoading={place.isPending} onClick={() => void send()}>{t('player.fnb.send')}</Button>
      <StatusMessage>{sent === null ? null : t('player.fnb.sent', { kot: sent, table: seat.tableName, seat: seat.seat })}</StatusMessage>
      {failure === null ? null : <ErrorMessage>{t(`player.fnb.failures.${failure}`)}</ErrorMessage>}
    </Stack>
  );
}
