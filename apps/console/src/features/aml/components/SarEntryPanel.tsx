import { useReviewSarEntry, type SarBuyIn, type SarEntry, type SarOutcome, type SarReviewFailure } from '@rivr/db/aml';
import { t, type MessageKey } from '@rivr/i18n';
import { Button, ChoiceChips, DataTable, ErrorMessage, Heading, Money, Stack, Text, TextArea, Time, type DataTableColumn } from '@rivr/ui';
import { useState } from 'react';

const FAILURE_COPY: Readonly<Record<SarReviewFailure, MessageKey>> = {
  not_allowed: 'console.amlFailures.notAllowed',
  invalid: 'console.amlFailures.invalid',
  paused: 'console.amlFailures.paused',
  unavailable: 'console.amlFailures.unavailable',
};

const OUTCOMES: readonly SarOutcome[] = ['no_action', 'monitor', 'reported'];

const BUY_IN_COLUMNS: readonly DataTableColumn<SarBuyIn>[] = [
  { key: 'source', header: t('console.aml.what'), cell: (row) => t(`console.aml.sources.${row.source}`), sortValue: (row) => row.source },
  { key: 'day', header: t('console.aml.day'), cell: (row) => <Time at={new Date(row.at)} show="day" />, sortValue: (row) => Date.parse(row.at) },
  { key: 'time', header: t('console.aml.time'), cell: (row) => <Time at={new Date(row.at)} /> },
  { key: 'amount', header: t('console.aml.amount'), align: 'end', cell: (row) => <Money paise={row.amount} />, sortValue: (row) => Number(row.amount) },
];

/** The review of an open entry: an outcome and a note of ten characters or more. */
function ReviewForm({ venueId, entryId }: { venueId: string; entryId: string }) {
  const review = useReviewSarEntry(venueId);
  const [outcome, setOutcome] = useState<SarOutcome[]>([]);
  const [note, setNote] = useState('');
  const [failure, setFailure] = useState<SarReviewFailure | null>(null);
  const chosen = outcome[0];
  const submit = async () => {
    const length = note.trim().length;
    if (chosen === undefined || length < 10 || length > 1000) return setFailure('invalid');
    const done = await review.mutateAsync({ entryId, outcome: chosen, note }).catch(() => null);
    setFailure(done === null ? 'unavailable' : done.ok ? null : done.error);
  };
  return (
    <Stack gap={4} align="start">
      <ChoiceChips label={t('console.aml.outcome')} mode="one" selected={outcome} onChange={setOutcome}
        options={OUTCOMES.map((value) => ({ value, label: t(`console.aml.outcomes.${value}`) }))} />
      <TextArea label={t('console.aml.note')} hint={t('console.aml.noteHint')} rows={3} value={note} onChange={(event) => setNote(event.target.value)} />
      {failure === null ? null : <ErrorMessage>{t(FAILURE_COPY[failure])}</ErrorMessage>}
      <Button variant="primary" isLoading={review.isPending} onClick={() => void submit()}>{t('console.aml.review')}</Button>
    </Stack>
  );
}

/** One register entry: the member and pattern, its cash buy-ins, and its review, or the form to make it. */
export function SarEntryPanel({ venueId, entry }: { venueId: string; entry: SarEntry }) {
  return (
    <Stack gap={4}>
      <Heading level={2}>{t('console.aml.memberLine', { name: entry.fullName, number: String(entry.memberNumber) })}</Heading>
      <Text tone="muted">{t(`console.aml.kinds.${entry.kind}`)}</Text>
      <DataTable label={t('console.aml.buyInsLabel')} columns={BUY_IN_COLUMNS} rowKey={(row) => row.id}
        rows={entry.buyIns} emptyText={t('console.aml.noBuyIns')} />
      {entry.outcome === null ? <ReviewForm key={entry.id} venueId={venueId} entryId={entry.id} /> : (
        <Stack gap={2}>
          <Text>{entry.reviewedBy === null ? t(`console.aml.outcomes.${entry.outcome}`)
            : t('console.aml.reviewed', { name: entry.reviewedBy, outcome: t(`console.aml.outcomes.${entry.outcome}`) })}</Text>
          {entry.note === null ? null : <Text tone="muted">{entry.note}</Text>}
        </Stack>
      )}
    </Stack>
  );
}
