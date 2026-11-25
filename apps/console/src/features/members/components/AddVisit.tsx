import { useAddVisit, useFloorTables, type AddVisitFailure, type AddVisitOutcome } from '@rivr/db';
import { clubDay, clubNightSpan } from '@rivr/domain/clubDay';
import { t } from '@rivr/i18n';
import { Button, ChoiceChips, ErrorMessage, Inline, Input, Stack, StatusMessage, Text } from '@rivr/ui';
import { useState, type ChangeEvent } from 'react';

const DAY_MS = 24 * 60 * 60 * 1000;

/** What the last press did: added, waiting or refused before; or why not, the form's own reasons first. */
type Said = { readonly done: AddVisitOutcome } | { readonly failure: AddVisitFailure | 'badTimes' | 'pickTable' } | null;

/** A refusal in words: the form's own, or the database's. */
function failureText(failure: AddVisitFailure | 'badTimes' | 'pickTable'): string {
  return failure === 'badTimes' || failure === 'pickTable' ? t(`console.members.visitsAdded.${failure}`) : t(`console.members.visitsAdded.failures.${failure}`);
}

function SaidLine({ said }: { said: Said }) {
  return (
    <>
      <StatusMessage>{said !== null && 'done' in said ? t(`console.members.visitsAdded.done.${said.done}`) : null}</StatusMessage>
      {said !== null && 'failure' in said ? <ErrorMessage>{failureText(said.failure)}</ErrorMessage> : null}
    </>
  );
}

/** The form's fields, each change a new request, so a press after an edit is an add of its own; kept while the form is closed. */
export function useVisitForm() {
  const [night, setNight] = useState(() => clubDay(new Date(Date.now() - DAY_MS)));
  const [checkIn, setCheckIn] = useState('20:00');
  const [checkOut, setCheckOut] = useState('23:00');
  const [tableId, setTableId] = useState<string | null>(null);
  const [reason, setReason] = useState('');
  const [requestId, setRequestId] = useState(() => crypto.randomUUID());
  const changed = (set: (value: string) => void) => (event: ChangeEvent<HTMLInputElement>) => { set(event.target.value); setRequestId(crypto.randomUUID()); };
  return {
    night, checkIn, checkOut, tableId, reason, requestId,
    onNight: changed(setNight), onCheckIn: changed(setCheckIn), onCheckOut: changed(setCheckOut), onReason: changed(setReason),
    onTable: (id: string | null) => { setTableId(id); setRequestId(crypto.randomUUID()); },
    reset: () => { setReason(''); setRequestId(crypto.randomUUID()); },
  };
}

/**
 * A past visit added to the member's record (the owner, 25 Nov; #1134), by the floor and up: its club night, check-in,
 * check-out, one table and a reason. A super admin's counts at once; anyone else's waits for a super admin, which it says.
 */
export function AddVisit({ venueId, memberId, form }: { venueId: string; memberId: string; form: ReturnType<typeof useVisitForm> }) {
  const tables = (useFloorTables().data ?? []).filter((table) => table.venueId === venueId);
  const add = useAddVisit(venueId);
  const [said, setSaid] = useState<Said>(null);
  const submit = async () => {
    const span = clubNightSpan(form.night, form.checkIn, form.checkOut);
    if (span === null) return setSaid({ failure: 'badTimes' });
    if (form.tableId === null) return setSaid({ failure: 'pickTable' });
    const done = await add.mutateAsync({ visit: { memberId, tableId: form.tableId, ...span, reason: form.reason }, requestId: form.requestId });
    setSaid(done.ok ? { done: done.value } : { failure: done.error });
    if (done.ok) form.reset();
    return undefined;
  };
  return (
    <Stack as="section" aria-label={t('console.members.visitsAdded.addTitle')} gap={3}>
      <Input variant="subtle" type="date" label={t('console.members.visitsAdded.night')} hint={t('console.members.visitsAdded.nightHint')} value={form.night}
        autoFocus onChange={form.onNight} />
      <Inline gap={3}>
        <Input variant="subtle" type="time" label={t('console.members.visitsAdded.checkIn')} value={form.checkIn} onChange={form.onCheckIn} />
        <Input variant="subtle" type="time" label={t('console.members.visitsAdded.checkOut')} value={form.checkOut} onChange={form.onCheckOut} />
      </Inline>
      <Stack gap={2}>
        <Text variant="caption" tone="muted">{t('console.members.visitsAdded.table')}</Text>
        <ChoiceChips look="subtle" mode="one" label={t('console.members.visitsAdded.table')} isLabelVisuallyHidden selected={form.tableId === null ? [] : [form.tableId]}
          options={tables.map((table) => ({ value: table.id, label: table.name }))} onChange={([value]) => form.onTable(value ?? null)} />
      </Stack>
      <Input variant="subtle" label={t('console.members.visitsAdded.reason')} hint={t('console.members.visitsAdded.reasonHint')} value={form.reason}
        maxLength={200} autoComplete="off" onChange={form.onReason} />
      <Inline>
        <Button variant="primary" size="compact" isLoading={add.isPending} isDisabled={form.reason.trim().length < 3} onClick={() => void submit()}>
          {t('console.members.visitsAdded.save')}
        </Button>
      </Inline>
      <SaidLine said={said} />
    </Stack>
  );
}
