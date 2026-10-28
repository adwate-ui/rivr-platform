import { useGlazaStatement, useImportGlaza, type GlazaStatement as Statement } from '@rivr/db/glaza';
import { recentClubMonths } from '@rivr/domain/clubDay';
import { formatDayTime, formatMonth, formatNumber, t } from '@rivr/i18n';
import { CameraButton, ChoiceChips, DataTable, ErrorMessage, Heading, Money, Stack, StatusMessage, Text, type DataTableColumn } from '@rivr/ui';
import { useState } from 'react';
import { readGlazaCsv } from './glazaCsv.ts';

/** The statement's figures, in the order they add up: the comps, then the alcohol margin, RIVR's half, and the payable. */
const FIGURES = ['foodComps', 'softDrinkComps', 'alcoholComps', 'comps', 'alcoholSales', 'alcoholCost', 'alcoholMargin', 'rivrShare', 'payable'] as const;
type Figure = { readonly key: (typeof FIGURES)[number]; readonly statement: Statement };

const COLUMNS: readonly DataTableColumn<Figure>[] = [
  { key: 'figure', header: t('console.fnb.glaza.figure'), cell: (row) => t(`console.fnb.glaza.figures.${row.key}`) },
  { key: 'amount', header: t('console.fnb.glaza.amount'), align: 'end', cell: (row) => <Money paise={row.statement[row.key]} /> },
];
// Lines named in a refusal: enough to find them in the file.
const BAD_LINES_SHOWN = 10;

/** The month's statement: when it was imported and how many lines matched a visit, then its figures. */
function StatementBody({ venueId, month }: { venueId: string; month: string }) {
  const statement = useGlazaStatement(venueId, month);
  const base = { label: t('console.fnb.glaza.table'), columns: COLUMNS, rowKey: (row: Figure) => row.key };
  if (statement.data === undefined) {
    return statement.isError ? <DataTable {...base} status="error" onRetry={() => void statement.refetch()} /> : <DataTable {...base} status="loading" />;
  }
  const data = statement.data;
  if (data === null) return <Text tone="muted">{t('console.fnb.glaza.none')}</Text>;
  return (
    <Stack gap={2}>
      <Text>{t('console.fnb.glaza.imported', { at: formatDayTime(new Date(data.importedAt)), lines: formatNumber(data.lines), matched: formatNumber(data.matched) })}</Text>
      <DataTable {...base} rows={FIGURES.map((key) => ({ key, statement: data }))} emptyText={t('console.fnb.glaza.none')} />
      <Text variant="small" tone="muted">{t('console.fnb.glaza.payableHint')}</Text>
    </Stack>
  );
}

/** Glaza's CSV for the month, read here, then imported whole; or the lines that do not read. */
function GlazaImport({ venueId, month }: { venueId: string; month: string }) {
  const importLines = useImportGlaza(venueId);
  const [outcome, setOutcome] = useState<{ ok: boolean; text: string } | null>(null);
  const read = (chosen: File) => void chosen.text().then(async (text) => {
    const file = readGlazaCsv(text);
    if (!file.ok) {
      const lines = file.badLines.slice(0, BAD_LINES_SHOWN).join(', ');
      setOutcome({ ok: false, text: lines === '' ? t('console.fnb.glaza.empty') : t('console.fnb.glaza.badLines', { lines }) });
      return;
    }
    const done = await importLines.mutateAsync({ month, lines: file.lines });
    setOutcome(done.ok ? { ok: true, text: t('console.fnb.glaza.importedLines', { lines: formatNumber(file.lines.length), month: formatMonth(month) }) }
      : { ok: false, text: t(`console.fnb.glaza.failures.${done.error}`) });
  });
  return (
    <>
      <CameraButton camera="none" accept="text/csv,.csv" variant="secondary" isLoading={importLines.isPending}
        onPhoto={(file) => { setOutcome(null); read(file); }}>
        {t('console.fnb.glaza.choose')}
      </CameraButton>
      <StatusMessage>{outcome?.ok === true ? outcome.text : null}</StatusMessage>
      {outcome?.ok === false ? <ErrorMessage>{outcome.text}</ErrorMessage> : null}
    </>
  );
}

/**
 * Glaza's statement (#109; decision 0265): a club month of Glaza's CSV, imported and matched to visits by table and time,
 * and what it comes to: the comps at cost, the alcohol margin split 50:50, and NewCo's payable to Glaza. The month
 * just ended is chosen first.
 */
export function GlazaStatement({ venueId }: { venueId: string }) {
  const [months] = useState(() => recentClubMonths(new Date(), 4));
  const [month, setMonth] = useState(months[1] ?? months[0] ?? '');
  return (
    <Stack gap={4}>
      <Heading level={2} variant="section">{t('console.fnb.glaza.title')}</Heading>
      <Text variant="small" tone="muted">{t('console.fnb.glaza.hint')}</Text>
      <ChoiceChips label={t('console.fnb.glaza.month')} mode="one" selected={[month]}
        options={months.map((first) => ({ value: first, label: formatMonth(first) }))} onChange={(picked) => setMonth(picked[0] ?? month)} />
      <GlazaImport key={month} venueId={venueId} month={month} />
      <StatementBody venueId={venueId} month={month} />
    </Stack>
  );
}
