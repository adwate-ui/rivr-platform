import { useTdsReturnExtract, type TdsExtractFailure } from '@rivr/db/tds';
import { formatNumber, formatQuarter, t } from '@rivr/i18n';
import { Button, ChoiceChips, ErrorMessage, Heading, Stack, Text } from '@rivr/ui';
import { useEffect, useState } from 'react';
import { tdsCsv } from './tdsCsv.ts';

/** An extract taken: its file, ready to save, and how many deductions it holds. */
interface Taken {
  readonly url: string;
  readonly file: string;
  readonly count: number;
  readonly quarter: string;
}

/**
 * The quarterly return extract (#93): choose a quarter, take the extract (recorded in the audit log),
 * then save it as a CSV file. Each take is a new file and a new audit entry.
 */
export function ReturnExtract({ venueId, quarters }: { venueId: string; quarters: readonly string[] }) {
  const extract = useTdsReturnExtract(venueId);
  const [quarter, setQuarter] = useState(quarters[0] ?? '');
  const [taken, setTaken] = useState<Taken | null>(null);
  const [failure, setFailure] = useState<TdsExtractFailure | null>(null);
  // The file lives in this page's memory until the next one replaces it, or the page closes.
  useEffect(() => (taken === null ? undefined : () => URL.revokeObjectURL(taken.url)), [taken]);
  const take = async () => {
    const done = await extract.mutateAsync(quarter);
    setFailure(done.ok ? null : done.error);
    if (!done.ok) return;
    // The byte-order mark tells a spreadsheet the file is UTF-8, so ₹ reads as ₹.
    const url = URL.createObjectURL(new Blob(['\uFEFF', tdsCsv(done.value)], { type: 'text/csv;charset=utf-8' }));
    setTaken({ url, file: `tds-return-${quarter}.csv`, count: done.value.length, quarter });
  };
  return (
    <Stack gap={4}>
      <Heading level={2}>{t('console.tds.extract')}</Heading>
      <Text variant="small" tone="muted">{t('console.tds.extractHint')}</Text>
      <ChoiceChips label={t('console.tds.quarter')} mode="one" selected={quarter === '' ? [] : [quarter]}
        options={quarters.map((start) => ({ value: start, label: formatQuarter(start) }))} onChange={(picked) => setQuarter(picked[0] ?? quarter)} />
      <Button isLoading={extract.isPending} onClick={() => void take()}>{t('console.tds.take')}</Button>
      {failure === null ? null : <ErrorMessage>{t(`console.tds.failures.${failure}`)}</ErrorMessage>}
      {taken === null ? null : (
        <Stack gap={2} align="start">
          <Text>{t('console.tds.ready', { count: formatNumber(taken.count), quarter: formatQuarter(taken.quarter) })}</Text>
          <Button href={taken.url} download={taken.file}>{t('console.tds.download', { file: taken.file })}</Button>
        </Stack>
      )}
    </Stack>
  );
}
