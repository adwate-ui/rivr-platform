import { usePracticeReset, usePracticeResetPreview, useStaffVenue, type PracticeResetFailure, type PracticeResetRow } from '@rivr/db';
import { formatNumber, t, type MessageKey } from '@rivr/i18n';
import { Button, DataTable, ErrorMessage, Input, Screen, Stack, Text, type DataTableColumn } from '@rivr/ui';
import { useState } from 'react';

const FAILURE_COPY: Readonly<Record<PracticeResetFailure, MessageKey>> = {
  not_allowed: 'console.practiceResetFailures.notAllowed',
  not_practice: 'console.practiceResetFailures.notPractice',
  no_seed: 'console.practiceResetFailures.noSeed',
  wrong_name: 'console.practiceResetFailures.wrongName',
  paused: 'console.practiceResetFailures.paused',
  too_soon: 'console.practiceResetFailures.tooSoon',
  held: 'console.practiceResetFailures.held',
  unavailable: 'console.practiceResetFailures.unavailable',
};

const COLUMNS: readonly DataTableColumn<PracticeResetRow>[] = [
  { key: 'table', header: t('console.practiceReset.table'), cell: (row) => row.table, sortValue: (row) => row.table },
  { key: 'now', header: t('console.practiceReset.now'), cell: (row) => formatNumber(row.now), sortValue: (row) => row.now, align: 'end' },
  { key: 'seed', header: t('console.practiceReset.seed'), cell: (row) => formatNumber(row.seed), sortValue: (row) => row.seed, align: 'end' },
];

/** The dry run, then the typed name and Reset to seed (#104). */
function PracticeResetPanel({ venueId }: { venueId: string }) {
  const preview = usePracticeResetPreview(venueId);
  const reset = usePracticeReset(venueId);
  const [name, setName] = useState('');
  const [outcome, setOutcome] = useState<'done' | PracticeResetFailure | null>(null);
  const submit = async () => {
    const done = await reset.mutateAsync(name);
    setOutcome(done.ok ? 'done' : done.error);
    if (done.ok) setName('');
  };
  const rows = preview.data ?? [];
  const state = preview.isPending ? { status: 'loading' as const }
    : preview.isError ? { status: 'error' as const, onRetry: () => void preview.refetch() }
    : { rows, emptyText: t('console.practiceReset.empty') };
  return (
    <Stack gap={6}>
      <Text>{t('console.practiceReset.intro')}</Text>
      {outcome === 'done' ? <Text>{t('console.practiceReset.done')}</Text> : null}
      {outcome !== null && outcome !== 'done' ? <ErrorMessage>{t(FAILURE_COPY[outcome])}</ErrorMessage> : null}
      {preview.isSuccess ? <Text tone="muted">{rows.some((row) => row.now !== row.seed) ? t('console.practiceReset.differs') : t('console.practiceReset.matches')}</Text> : null}
      <DataTable label={t('console.practiceReset.tableLabel')} columns={COLUMNS} rowKey={(row) => row.table} {...state} />
      <Stack gap={3} align="start">
        <Input label={t('console.practiceReset.typeName')} value={name} onChange={(event) => setName(event.target.value)} autoComplete="off" />
        <Button variant="primary" isLoading={reset.isPending} onClick={() => void submit()}>{t('console.practiceReset.reset')}</Button>
      </Stack>
    </Stack>
  );
}

/**
 * Practice reset (#104; features "Purge"; additions flow 16), for super admins at the practice venue: each
 * table a reset reloads with its rows now and in the seed, then the venue's name typed and Reset to seed.
 * The club is never reset (the owner's decision on #104; purging a live venue is #432).
 */
export function PracticeResetScreen() {
  const staff = useStaffVenue();
  // The frame shows a screen only once the staff member's venue is known.
  if (staff.status !== 'ready') return null;
  const title = t('console.practiceReset.title');
  if (!staff.venue.permissions.includes('purge.run')) return <Screen title={title} status="error" errorText={t('console.practiceReset.notAllowed')} />;
  if (!staff.venue.isPractice) return <Screen title={title} status="error" errorText={t('console.practiceReset.notPractice')} />;
  return (
    <Screen title={title}>
      <PracticeResetPanel venueId={staff.venue.venueId} />
    </Screen>
  );
}
