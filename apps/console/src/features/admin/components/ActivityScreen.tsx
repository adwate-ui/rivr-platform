import { ACTIVITY_KINDS, ACTIVITY_PAGE, useActivityPage, useStaffVenue, type ActivityFilters, type ActivityKind, type ActivityLine } from '@rivr/db';
import { activityActionWord, activityEntityWord, formatDateTime, formatHighHand, formatList, formatNumber, t } from '@rivr/i18n';
import { ChoiceChips, DataTable, Inline, Input, Screen, Stack, type DataTableColumn } from '@rivr/ui';
import { useDeferredValue, useState } from 'react';

const ALL = 'all';

function whoOf(line: ActivityLine): string {
  return line.who ?? t(line.isSystem ? 'console.activity.system' : 'console.activity.unknown');
}

function recordOf(line: ActivityLine): string {
  const thing = activityEntityWord(line.entity);
  return line.about === null ? thing : t('console.activity.recordOf', { thing, name: line.about });
}

/** What was done, and how much for Bonus by hand. */
function whatOf(line: ActivityLine): string {
  const what = activityActionWord(line.action);
  return line.amount === null ? what : t('console.activity.withAmount', { what, amount: formatNumber(line.amount) });
}

/** Why, as it was given; for a high hand paid, the hand and where (redesign RD-24). */
function whyOf(line: ActivityLine): string {
  const hit = line.highHand;
  if (hit === null) return line.reason ?? '';
  return t('console.activity.highHand', { hand: formatHighHand(hit.hand, hit.rank), table: hit.table, seat: hit.seat });
}

/** The columns: the narrowing is the screen's, on the whole log, so the table's own filters, which see one page, are off. */
function columns(): readonly DataTableColumn<ActivityLine>[] {
  const when = (line: ActivityLine) => formatDateTime(new Date(line.occurredAt));
  const kind = (line: ActivityLine) => t(`console.activity.kinds.${line.kind}`);
  return [
    // Two shares, so a day and its time stay on one line.
    { key: 'when', header: t('console.activity.when'), cell: when, exportValue: when, isWide: true, filter: false },
    { key: 'who', header: t('console.activity.who'), cell: whoOf, exportValue: whoOf, filter: false },
    { key: 'kind', header: t('console.activity.kind'), cell: kind, exportValue: kind, filter: false },
    { key: 'what', header: t('console.activity.what'), cell: whatOf, exportValue: whatOf, filter: false },
    { key: 'record', header: t('console.activity.record'), cell: recordOf, exportValue: recordOf, isWide: true, filter: false },
    { key: 'why', header: t('console.activity.why'), cell: whyOf, exportValue: whyOf, isWide: true, filter: false },
  ];
}

/** The screen's narrowing in words, as an export records it (#102). */
function filterWords({ from, to, who, kind }: ActivityFilters): string | undefined {
  const label = (key: 'from' | 'to' | 'person' | 'kind', value: string) => t('console.exportFilters.choice', { label: t(`console.activity.${key}`), value });
  const words = [
    ...(from === null ? [] : [label('from', from)]), ...(to === null ? [] : [label('to', to)]), ...(who === null ? [] : [label('person', who)]),
    ...(kind === null ? [] : [label('kind', t(`console.activity.kinds.${kind}`))]),
  ];
  return words.length === 0 ? undefined : formatList(words);
}

/** Person, From and To, and the kinds as a row of chips (no select in @rivr/ui, ui.md). */
function Filters({ who, onWho, from, onFrom, to, onTo, kind, onKind }: {
  who: string; onWho: (value: string) => void; from: string; onFrom: (value: string) => void; to: string; onTo: (value: string) => void;
  kind: ActivityKind | null; onKind: (kind: ActivityKind | null) => void;
}) {
  return (
    <Stack gap={4}>
      <Inline gap={4} align="start" wrap>
        <Input label={t('console.activity.person')} value={who} autoComplete="off" onChange={(event) => onWho(event.target.value)} />
        <Input type="date" label={t('console.activity.from')} value={from} onChange={(event) => onFrom(event.target.value)} />
        <Input type="date" label={t('console.activity.to')} value={to} onChange={(event) => onTo(event.target.value)} />
      </Inline>
      <ChoiceChips label={t('console.activity.kind')} isLabelVisuallyHidden mode="one" look="subtle" isOneRow selected={[kind ?? ALL]}
        options={[{ value: ALL, label: t('console.activity.allKinds') }, ...ACTIVITY_KINDS.map((value) => ({ value, label: t(`console.activity.kinds.${value}`) }))]}
        onChange={([picked]) => onKind(ACTIVITY_KINDS.find((one) => one === picked) ?? null)} />
    </Stack>
  );
}

/**
 * The lines the narrowing leaves, a page of fifty from the server with the table's own pages in its foot (redesign RD-31).
 * The narrowing is the screen's, so a change of it starts again from the first page. Export reads every line it leaves.
 */
function Lines({ venueId, filters, exportIn }: { venueId: string; filters: ActivityFilters; exportIn: HTMLElement | null }) {
  const [page, setPage] = useState(1);
  const log = useActivityPage(venueId, filters, page);
  const exportFilter = filterWords(filters);
  const base = {
    label: t('console.activity.title'), columns: columns(), rowKey: (line: ActivityLine) => String(line.id), narrowLayout: 'scroll' as const, exportIn,
    ...(exportFilter === undefined ? {} : { exportFilter }),
    server: { total: log.data?.total ?? 0, pageSize: ACTIVITY_PAGE, scope: JSON.stringify(filters), onRequest: (request: { page: number }) => setPage(request.page) },
    exportRows: log.readEvery,
  };
  if (log.isError) return <DataTable {...base} status="error" onRetry={() => void log.refetch()} />;
  if (log.data === undefined) return <DataTable {...base} status="loading" />;
  return <DataTable {...base} rows={log.data.lines} emptyText={t('console.activity.empty')} />;
}

function Body({ venueId }: { venueId: string }) {
  const [who, setWho] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [kind, setKind] = useState<ActivityKind | null>(null);
  const [exportIn, setExportIn] = useState<HTMLElement | null>(null);
  // A name is read when the typing settles.
  const typed = useDeferredValue(who.trim());
  const filters = { who: typed === '' ? null : typed, from: from === '' ? null : from, to: to === '' ? null : to, kind };
  return (
    <Screen title={t('console.activity.title')} onActionsSlot={setExportIn}>
      <Stack gap={6}>
        <Filters who={who} onWho={setWho} from={from} onFrom={setFrom} to={to} onTo={setTo} kind={kind} onKind={setKind} />
        <Lines venueId={venueId} filters={filters} exportIn={exportIn} />
      </Stack>
    </Screen>
  );
}

/**
 * Activity (8 Nov audit, F-034), for super admins: the audit log in words, who did what, about whom, why and when, newest first.
 * It narrows on the server by person, kind and club day, a page at a time by the table's foot, and its Export takes every line the narrowing leaves.
 */
export function ActivityScreen() {
  const staff = useStaffVenue();
  // The frame shows a screen only once the staff member's venue is known.
  if (staff.status !== 'ready') return null;
  const title = t('console.activity.title');
  if (!staff.venue.permissions.includes('activity.read')) return <Screen title={title} status="error" errorText={t('console.activity.notAllowed')} />;
  return <Body venueId={staff.venue.venueId} />;
}
