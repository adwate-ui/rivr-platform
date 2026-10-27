import {
  useControlState, useLivePurgePreview, usePurgeFilesLeft, usePurgeLiveVenue, useRemovePurgedFiles, useStaffVenue, type LivePurgeFailure,
  type LivePurgeRow, type PurgedFiles,
} from '@rivr/db';
import { formatNumber, t, type MessageKey } from '@rivr/i18n';
import { Button, DataTable, ErrorMessage, Heading, Input, Screen, Stack, Text, TextArea, type DataTableColumn } from '@rivr/ui';
import { useState } from 'react';
import { ArchiveStatus } from './ArchiveStatus.tsx';
import { useArchiveExport } from './useArchiveExport.ts';

const FAILURE_COPY: Readonly<Record<LivePurgeFailure, MessageKey>> = {
  not_allowed: 'console.purgeFailures.notAllowed',
  practice: 'console.purgeFailures.practice',
  not_frozen: 'console.purgeFailures.notFrozen',
  no_archive: 'console.purgeFailures.noArchive',
  changed: 'console.purgeFailures.changed',
  wrong_name: 'console.purgeFailures.wrongName',
  held: 'console.purgeFailures.held',
  busy: 'console.purgeFailures.busy',
  too_often: 'console.purgeFailures.tooOften',
  unavailable: 'console.purgeFailures.unavailable',
};

const COLUMNS: readonly DataTableColumn<LivePurgeRow>[] = [
  { key: 'table', header: t('console.purge.table'), cell: (row) => row.table, sortValue: (row) => row.table },
  { key: 'rows', header: t('console.purge.rows'), cell: (row) => formatNumber(row.rows), sortValue: (row) => row.rows, align: 'end' },
];

/**
 * The full archive first, with the KYC photos and receipts (the purge removes them, so the archive is the only copy):
 * made, saved and marked saved, as the purge needs within 30 minutes.
 */
function ArchiveStep({ venueId }: { venueId: string }) {
  const archive = useArchiveExport(venueId);
  const [reason, setReason] = useState('');
  return (
    <Stack gap={3} align="start">
      <Heading level={2}>{t('console.purge.archiveTitle')}</Heading>
      <Text tone="muted">{t('console.purge.archiveHint')}</Text>
      <TextArea label={t('console.purge.kycReason')} hint={t('console.purge.kycReasonHint')} rows={2} value={reason}
        onChange={(event) => setReason(event.target.value)} />
      <ArchiveStatus state={archive.state} />
      <Button isDisabled={reason.trim().length < 10} isLoading={archive.state.status === 'running'}
        onClick={() => void archive.run({ memberId: null, memberNumber: null }, reason.trim())}>
        {t('console.exportArchive.make')}
      </Button>
    </Stack>
  );
}

/** The files after the purge: how many went, or how many are left with the button to try again. */
function FilesOutcome({ files, isPending, onAgain }: { files: PurgedFiles | null; isPending: boolean; onAgain: () => void }) {
  if (files !== null && files.left === 0) return <Text>{t('console.purge.filesRemoved', { files: formatNumber(files.removed) })}</Text>;
  return (
    <Stack gap={2} align="start">
      {files === null ? null : <ErrorMessage>{t('console.purge.filesLeft', { left: formatNumber(files.left) })}</ErrorMessage>}
      <Button isLoading={isPending} onClick={onAgain}>{t('console.purge.filesAgain')}</Button>
    </Stack>
  );
}

/** The purge, then its files: the rows deleted from the console itself, then the archived files removed. */
function usePurge(venueId: string) {
  const purge = usePurgeLiveVenue(venueId);
  const removeFiles = useRemovePurgedFiles(venueId);
  const [rows, setRows] = useState<number | null>(null);
  const [files, setFiles] = useState<PurgedFiles | null>(null);
  const [failure, setFailure] = useState<LivePurgeFailure | null>(null);
  const filesAgain = async () => {
    const done = await removeFiles.mutateAsync();
    setFailure(done.ok ? null : done.error);
    if (done.ok) setFiles(done.value);
  };
  const run = async (venueName: string) => {
    const done = await purge.mutateAsync({ venueName });
    setFailure(done.ok ? null : done.error);
    if (!done.ok) return;
    setRows(done.value);
    await filesAgain();
  };
  return { rows, files, failure, run, filesAgain, isPurging: purge.isPending, isRemoving: removeFiles.isPending };
}

/** The dry run, then the typed name and Purge the venue; once purged, its files. */
function PurgeStep({ venueId }: { venueId: string }) {
  const preview = useLivePurgePreview(venueId, true);
  const purge = usePurge(venueId);
  const [name, setName] = useState('');
  const failure = purge.failure === null ? null : <ErrorMessage>{t(FAILURE_COPY[purge.failure])}</ErrorMessage>;
  if (purge.rows !== null) {
    return (
      <Stack gap={4} align="start">
        <Text>{t('console.purge.purged', { count: formatNumber(purge.rows) })}</Text>
        {failure}
        <FilesOutcome files={purge.files} isPending={purge.isRemoving} onAgain={() => void purge.filesAgain()} />
      </Stack>
    );
  }
  const state = preview.isPending ? { status: 'loading' as const }
    : preview.isError ? { status: 'error' as const, onRetry: () => void preview.refetch() }
    : { rows: preview.data, emptyText: t('console.purge.empty') };
  return (
    <Stack gap={4} align="start">
      <DataTable label={t('console.purge.tableLabel')} columns={COLUMNS} rowKey={(row) => row.table} {...state} />
      <Input label={t('console.purge.typeName')} value={name} onChange={(event) => setName(event.target.value)} autoComplete="off" />
      {failure}
      <Button variant="danger" isLoading={purge.isPurging} onClick={() => void purge.run(name)}>{t('console.purge.purge')}</Button>
    </Stack>
  );
}

/** Files an earlier purge left, offered again when the screen opens: a lost answer or a closed tab loses nothing. */
function LastPurgeFiles({ venueId }: { venueId: string }) {
  const left = usePurgeFilesLeft(venueId);
  const removeFiles = useRemovePurgedFiles(venueId);
  const [failure, setFailure] = useState<LivePurgeFailure | null>(null);
  if (left.data === undefined || left.data === 0) return null;
  const again = async () => {
    const done = await removeFiles.mutateAsync();
    setFailure(done.ok ? null : done.error);
  };
  return (
    <Stack gap={2} align="start">
      <ErrorMessage>{t('console.purge.lastPurgeFiles', { left: formatNumber(left.data) })}</ErrorMessage>
      {failure === null ? null : <ErrorMessage>{t(FAILURE_COPY[failure])}</ErrorMessage>}
      <Button isLoading={removeFiles.isPending} onClick={() => void again()}>{t('console.purge.filesAgain')}</Button>
    </Stack>
  );
}

function PurgePanel({ venueId }: { venueId: string }) {
  const controls = useControlState(venueId);
  return (
    <Stack gap={8}>
      <Text>{t('console.purge.intro')}</Text>
      <LastPurgeFiles venueId={venueId} />
      {controls.isVenueFrozen ? null : <ErrorMessage>{t('console.purge.freezeFirst')}</ErrorMessage>}
      <ArchiveStep venueId={venueId} />
      {controls.isVenueFrozen ? <PurgeStep venueId={venueId} /> : null}
    </Stack>
  );
}

/**
 * Purge (#432; features "Purge"; decision 0239), for super admins at a live venue: freeze it, make and save the full
 * archive with the KYC photos, see what the purge deletes, type the venue's name; then its files go. The practice venue
 * resets to its seed instead (#104).
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
