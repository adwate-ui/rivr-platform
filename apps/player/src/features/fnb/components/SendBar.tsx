import type { MySeat } from '@rivr/db';
import { usePlaceFnbOrder, type FnbFailure } from '@rivr/db/fnb';
import { t } from '@rivr/i18n';
import { Box, Button, ErrorMessage, haptic, PlayerDock, Stack, Text, useToast } from '@rivr/ui';
import { useNavigate } from '@tanstack/react-router';
import { useState } from 'react';

/**
 * The sticky foot of the Order screen once anything is added (brief 3.5): Send to the bar with how many items. Sent, the
 * phone buzzes, Tonight shows the order on its way and a toast says so. One request id an order, kept to retry one whose
 * reply was lost, and new with any change to it (F3-18).
 */
export function SendBar({ seat, counts, onSent }: { seat: MySeat; counts: Readonly<Record<string, number>>; onSent: () => void }) {
  const place = usePlaceFnbOrder();
  const navigate = useNavigate();
  const toast = useToast();
  const [failure, setFailure] = useState<FnbFailure | null>(null);
  const lines = Object.entries(counts).filter(([, quantity]) => quantity > 0).map(([itemId, quantity]) => ({ item_id: itemId, quantity }));
  const key = JSON.stringify(lines);
  const [request, setRequest] = useState({ key, id: crypto.randomUUID() });
  if (request.key !== key) setRequest({ key, id: crypto.randomUUID() });
  const count = lines.reduce((sum, line) => sum + line.quantity, 0);
  if (count === 0) return null;
  const send = async () => {
    const outcome = await place.mutateAsync({ lines, requestId: request.id });
    setFailure(outcome.ok ? null : outcome.error);
    if (!outcome.ok) return;
    haptic();
    onSent();
    toast(t('player.order.sentToast'));
    void navigate({ to: '/' });
  };
  return (
    <PlayerDock>
      <Box surface="raised" hairline="top" paddingX={5} paddingY={4}>
        <Stack gap={2}>
          <Button variant="primary" size="tall" fullWidth isLoading={place.isPending} onClick={() => void send()}
            aside={<Text as="span" tone="onAction">{count === 1 ? t('player.order.itemsOne') : t('player.order.items', { count })}</Text>}>
            <Text as="span" tone="onAction" weight="semibold">{t('player.order.send')}</Text>
          </Button>
          {failure === null ? null : <ErrorMessage look="dot">{t(`player.fnb.failures.${failure}`, { table: seat.tableName, seat: seat.seat })}</ErrorMessage>}
        </Stack>
      </Box>
    </PlayerDock>
  );
}
