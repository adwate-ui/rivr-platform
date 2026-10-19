import { useWaitlistCallActions, type FloorTable, type WaitlistFailure } from '@rivr/db';
import { t } from '@rivr/i18n';
import { Button, ChoiceChips, ErrorMessage, Inline, Input, Stack } from '@rivr/ui';
import { useState } from 'react';
import { FAILURE_COPY } from './failureCopy.ts';

interface CallFormProps {
  entryId: string;
  name: string;
  /** The game's open tables, one of which the member is called to. */
  tables: readonly FloorTable[];
  onDone: () => void;
}

/** Calls a member to an open table of their game and a seat at it; the seat call goes out by WhatsApp. */
export function CallForm({ entryId, name, tables, onDone }: CallFormProps) {
  const { call } = useWaitlistCallActions();
  const [tableIds, setTableIds] = useState<string[]>(tables.length === 1 && tables[0] ? [tables[0].id] : []);
  const [seat, setSeat] = useState('');
  const [failure, setFailure] = useState<WaitlistFailure | null>(null);
  const callNow = async () => {
    const tableId = tableIds[0];
    const seatNumber = Number(seat);
    if (!tableId || !Number.isInteger(seatNumber) || seatNumber < 1) {
      setFailure('invalid');
      return;
    }
    const called = await call.mutateAsync({ entryId, tableId, seat: seatNumber });
    if (called.ok) onDone();
    else setFailure(called.error);
  };
  return (
    <Stack gap={3}>
      <ChoiceChips label={t('console.waitlist.callTable', { name })} mode="one" selected={tableIds} onChange={setTableIds}
        options={tables.map((table) => ({ value: table.id, label: table.name }))} />
      <Inline gap={3} align="end">
        <Input label={t('console.waitlist.callSeat')} inputMode="numeric" value={seat} onChange={(event) => setSeat(event.target.value)} autoComplete="off" />
        <Button variant="secondary" isLoading={call.isPending} onClick={() => void callNow()}>{t('console.waitlist.callConfirm')}</Button>
        <Button variant="text" onClick={onDone}>{t('common.cancel')}</Button>
      </Inline>
      {failure === null ? null : <ErrorMessage>{t(failure === 'invalid' ? 'console.waitlist.invalidCall' : FAILURE_COPY[failure])}</ErrorMessage>}
    </Stack>
  );
}
