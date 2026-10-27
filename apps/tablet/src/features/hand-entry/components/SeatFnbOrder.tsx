import { useMyDevice } from '@rivr/db';
import { useFnbMenu, useTabletFnbOrder, type FnbFailure } from '@rivr/db/fnb';
import { t } from '@rivr/i18n';
import { Button, ErrorMessage, Heading, Inline, LoadState, QuantityStepper, Stack, StatusMessage, Text } from '@rivr/ui';
import { useState } from 'react';

interface MenuStepperProps {
  menu: ReturnType<typeof useFnbMenu>;
  counts: Readonly<Record<string, number>>;
  onChange: (itemId: string, quantity: number) => void;
}

/** The venue's menu, how many of each item; or its loading, error or empty line. */
function MenuSteppers({ menu, counts, onChange }: MenuStepperProps) {
  if (menu.data === undefined) return <LoadState isError={menu.isError} onRetry={() => void menu.refetch()} />;
  if (menu.data.length === 0) return <Text>{t('tablet.fnb.empty')}</Text>;
  return (
    <Stack gap={2}>
      {menu.data.map((item) => (
        <QuantityStepper key={item.itemId} label={item.name} value={counts[item.itemId] ?? 0} onChange={(quantity) => onChange(item.itemId, quantity)} />
      ))}
    </Stack>
  );
}

/**
 * The dealer orders food and drink for a seat (#123): the venue's menu, how many of each, and Send to the bar. Paid by
 * the player to Glaza; the KOT prints at the bar.
 */
export function SeatFnbOrder({ seat, onClose }: { seat: number; onClose: () => void }) {
  const venueId = useMyDevice().data?.venueId ?? null;
  const menu = useFnbMenu(venueId);
  const order = useTabletFnbOrder();
  const [counts, setCounts] = useState<Readonly<Record<string, number>>>({});
  const [sent, setSent] = useState<number | null>(null);
  const [failure, setFailure] = useState<FnbFailure | null>(null);
  const lines = Object.entries(counts).filter(([, quantity]) => quantity > 0).map(([itemId, quantity]) => ({ item_id: itemId, quantity }));
  const send = async () => {
    const outcome = await order.mutateAsync({ seat, lines });
    setFailure(outcome.ok ? null : outcome.error);
    setSent(outcome.ok ? outcome.value.kotNumber : null);
    if (outcome.ok) setCounts({});
  };
  return (
    <Stack gap={3}>
      <Heading level={3}>{t('tablet.fnb.title', { seat })}</Heading>
      <MenuSteppers menu={menu} counts={counts} onChange={(itemId, quantity) => { setCounts({ ...counts, [itemId]: quantity }); setSent(null); }} />
      <Text variant="small" tone="muted">{t('tablet.fnb.paid')}</Text>
      <Inline gap={3}>
        <Button variant="secondary" isDisabled={lines.length === 0} isLoading={order.isPending} onClick={() => void send()}>{t('tablet.fnb.send')}</Button>
        <Button variant="text" onClick={onClose}>{t('tablet.fnb.close')}</Button>
      </Inline>
      <StatusMessage>{sent === null ? null : t('tablet.fnb.sent', { kot: sent })}</StatusMessage>
      {failure === null ? null : <ErrorMessage>{t(`tablet.fnb.failures.${failure}`)}</ErrorMessage>}
    </Stack>
  );
}
