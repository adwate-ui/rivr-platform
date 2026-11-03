import { useWaitlistActions, type WaitlistFailure, type WaitlistPlace } from '@rivr/db';
import { formatTime, t } from '@rivr/i18n';
import { Box, Button, ErrorMessage, Figure, Stack, Text, useToast } from '@rivr/ui';
import { useState, type ReactNode } from 'react';
import { lineOf, WAITLIST_FAILURE_COPY } from './waitlistCopy.ts';

/** Leaving the list, with Undo: back on the same table's list (at its end: a place is not kept). */
function useLeave(place: WaitlistPlace) {
  const { leave, joinAt } = useWaitlistActions();
  const toast = useToast();
  const [failure, setFailure] = useState<WaitlistFailure | null>(null);
  const rejoin = () => void joinAt.mutateAsync({ tableId: place.tableId, requestId: crypto.randomUUID() });
  const go = async () => {
    const left = await leave.mutateAsync(place.entryId);
    setFailure(left.ok ? null : left.error);
    if (left.ok) toast(t('player.live.list.leftToast'), { onUndo: rejoin });
  };
  return { go, isPending: leave.isPending, failure };
}

/**
 * On the list (brief 3.4 C): the list's table (decision 0467) and game, the place as a large numeral, "Next in line" or where, when they
 * joined, and Leave waitlist. No Step away. `offer` is Profile's offer of seat-ready push, through the route.
 */
export function WaitingView({ place, offer }: { place: WaitlistPlace; offer: ReactNode }) {
  const leave = useLeave(place);
  const eyebrow = t('player.live.list.eyebrow', { table: place.tableName, game: place.tableTypeName });
  return (
    <Stack gap={8}>
      <Box paddingX={6} paddingY={8}>
        <Stack gap={2} align="center">
          <Text variant="eyebrow" tone="accent" align="center">{eyebrow}</Text>
          {place.place === null ? null : <Figure size="place">{String(place.place)}</Figure>}
          <Text variant="lead" align="center">{lineOf(place)}</Text>
          <Text variant="small" tone="muted" align="center">{t('player.live.list.joined', { time: formatTime(new Date(place.joinedAt)) })}</Text>
        </Stack>
      </Box>
      <Box paddingX={5}>
        <Stack gap={4}>
          <Button variant="outline" size="large" fullWidth isLoading={leave.isPending} onClick={() => void leave.go()}>
            {t('player.live.list.leave')}
          </Button>
          {leave.failure === null ? null : <ErrorMessage look="dot">{t(WAITLIST_FAILURE_COPY[leave.failure])}</ErrorMessage>}
          {offer}
        </Stack>
      </Box>
    </Stack>
  );
}
