import { useSeatActions, type FloorTable, type InterestList, type SeatFailure } from '@rivr/db';
import { t, type MessageKey } from '@rivr/i18n';
import { Button, ErrorMessage, Inline, Stack, Text } from '@rivr/ui';
import { useState } from 'react';

/** Why the table did not open: the role, a frozen venue, or anything else. */
const openFailureCopy = (failure: SeatFailure): MessageKey => {
  if (failure === 'not_allowed') return 'console.waitlist.openNotAllowed';
  return failure === 'paused' ? 'console.waitlist.openPaused' : 'console.waitlist.openFailed';
};

/** How many are interested, and how many the venue opens a table at, when it says. */
function interestLine(interest: InterestList): string {
  if (interest.isReady) return t('console.waitlist.interestReady', { count: interest.waiting });
  if (interest.playersToOpen === null) return t('console.waitlist.interest', { count: interest.waiting });
  return t('console.waitlist.interestShort', { count: interest.waiting, needed: interest.playersToOpen });
}

interface InterestNoticeProps {
  venueId: string;
  interest: InterestList;
  /** One of the game's closed tables, to open. */
  table: FloorTable | undefined;
  /** Whether the staff member opens tables (floor.manage). */
  canOpen: boolean;
}

/**
 * A game not running (#113, decision 0184): its waitlist is its interest list. Once as many wait as the
 * venue opens a table at, it says so, and a floor manager opens one of the game's tables here.
 */
export function InterestNotice({ venueId, interest, table, canOpen }: InterestNoticeProps) {
  const { setOpen } = useSeatActions(venueId);
  const [failure, setFailure] = useState<SeatFailure | null>(null);
  const open = async (tableId: string) => {
    const done = await setOpen.mutateAsync({ tableId, isOpen: true });
    setFailure(done.ok ? null : done.error);
  };
  return (
    <Stack gap={2}>
      <Inline gap={4} align="center">
        <Text tone={interest.isReady ? 'money' : 'muted'}>{interestLine(interest)}</Text>
        {interest.isReady && canOpen && table !== undefined ? (
          <Button variant="primary" isLoading={setOpen.isPending} onClick={() => void open(table.id)}>{t('console.waitlist.openTable', { table: table.name })}</Button>
        ) : null}
      </Inline>
      {failure === null ? null : <ErrorMessage>{t(openFailureCopy(failure))}</ErrorMessage>}
    </Stack>
  );
}
