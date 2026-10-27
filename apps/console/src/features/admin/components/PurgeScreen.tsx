import { useControlState, useLivePurgePreview, usePurgeLiveVenue, useStaffVenue, type LivePurgeFailure, type LivePurgeRow } from '@rivr/db';
import { formatNumber, t, type MessageKey } from '@rivr/i18n';
import { Button, DataTable, ErrorMessage, Heading, Input, Screen, Stack, Text, type DataTableColumn } from '@rivr/ui';
import { useState } from 'react';
import { ArchiveStatus } from './ArchiveStatus.tsx';
import { useArchiveExport } from './useArchiveExport.ts';

const FAILURE_COPY: Readonly<Record<LivePurgeFailure, MessageKey>> = {
  not_allowed: 'console.purgeFailures.notAllowed',
  practice: 'console.purgeFailures.practice',
  not_frozen: 'console.purgeFailures.notFrozen',
  no_archive: 'console.purgeFailures.noArchive',
  wrong_name: 'console.purgeFailures.wrongName',
  held: 'console.purgeFailures.held',
  unavailable: 'console.purgeFailures.unavailable',
};

const COLUMNS: readonly DataTableColumn<LivePurgeRow>[] = [
  { key: 'table', header: t('console.purge.table'), cell: (row) => row.table, sortValue: (row) => row.table },
  { key: 'rows', header: t('console.purge.rows'), cell: (row) => formatNumber(row.rows), sortValue: (row) => row.rows, align: 'end' },
];

/** The full archive first: made, saved and marked saved, as the purge needs within 30 minutes. */
function ArchiveStep({ venueId }: { venueId: string }) {
  const archive = useArchiveExport(venueId);
  return (
    <Stack gap={3} align="start">
      <Heading level={2}>{t('console.purge.archiveTitle')}</Heading>
      <Text tone="muted">{t('console.purge.archiveHint')}</Text>
      <ArchiveStatus state={archive.state} />
      <Button isLoading={archive.state.status === 'running'} onClick={() => void archive.run({ memberId: null, memberNumber: null }, null)}>
        {t('console.exportArchive.make')}
      </Button>
    </Stack>
  );
}

/** The dry run, then the typed name and Purge the venue. */
function PurgeStep({ venueId }: { venueId: string }) {
  const preview = useLivePurgePreview(venueId, true);
  const purge = usePurgeLiveVenue(venueId);
  const [name, setName] = useState('');
  const [outcome, setOutcome] = useState<{ ok: true; count: number } | { ok: false; failure: LivePurgeFailure } | null>(null);
  const submit = async () => {
    const done = await purge.mutateAsync(name);
    setOutcome(done.ok ? { ok: true, count: done.value } : { ok: false, failure: done.error });
    if (done.ok) setName('');
  };
  const state = preview.isPending ? { status: 'loading' as const }
    : preview.isError ? { status: 'error' as const, onRetry: () => void preview.refetch() }
    : { rows: preview.data, emptyText: t('console.purge.empty') };
  return (
    <Stack gap={4} align="start">
      <DataTable label={t('console.purge.tableLabel')} columns={COLUMNS} rowKey={(row) => row.table} {...state} />
      <Input label={t('console.purge.typeName')} value={name} onChange={(event) => setName(event.target.value)} autoComplete="off" />
      {outcome === null ? null : outcome.ok ? <Text>{t('console.purge.done', { count: formatNumber(outcome.count) })}</Text>
        : <ErrorMessage>{t(FAILURE_COPY[outcome.failure])}</ErrorMessage>}
      <Button variant="danger" isLoading={purge.isPending} onClick={() => void submit()}>{t('console.purge.purge')}</Button>
    </Stack>
  );
}

function PurgePanel({ venueId }: { venueId: string }) {
  const controls = useControlState(venueId);
  return (
    <Stack gap={8}>
      <Text>{t('console.purge.intro')}</Text>
      {controls.isVenueFrozen ? null : <ErrorMessage>{t('console.purge.freezeFirst')}</ErrorMessage>}
      <ArchiveStep venueId={venueId} />
      {controls.isVenueFrozen ? <PurgeStep venueId={venueId} /> : null}
    </Stack>
  );
}

/**
 * Purge (#432; features "Purge"; decision 0239), for super admins at a live venue: freeze it, make and save the full
 * archive, see what the purge deletes, then type the venue's name. The practice venue resets to its seed instead (#104).
 */
export function PurgeScreen() {
  const staff = useStaffVenue();
  // The frame shows a screen only once the staff member's venue is known.
  if (staff.status !== 'ready') return null;
  const title = t('console.purge.title');
  if (!staff.venue.permissions.includes('purge.run')) return <Screen title={title} status="error" errorText={t('console.purge.notAllowed')} />;
  if (staff.venue.isPractice) return <Screen title={title} status="error" errorText={t('console.purge.practice')} />;
  return (
    <Screen title={title}>
      <PurgePanel venueId={staff.venue.venueId} />
    </Screen>
  );
}
