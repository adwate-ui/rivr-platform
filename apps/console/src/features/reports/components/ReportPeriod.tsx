import { clubDay, dayAfter } from '@rivr/domain/clubDay';
import { isTableSpan } from '@rivr/domain/tables';
import { t } from '@rivr/i18n';
import { ChoiceChips, ErrorMessage, Inline, Input, Stack } from '@rivr/ui';
import { useState, type ReactNode } from 'react';

/** The spans the reports offer: tonight's club day, the last 7, 30 or 90, or dates of one's own (F-107). */
const SPANS = { today: 1, week: 7, month: 30, quarter: 90 } as const;
type Span = keyof typeof SPANS | 'custom';
const SPAN_KEYS: readonly Span[] = ['today', 'week', 'month', 'quarter', 'custom'];

interface Range {
  readonly from: string;
  readonly to: string;
}

/** The club days a report is read over, 1 to 92 of them, and the same in words, as an export records them (#102). */
export interface ReportPeriod extends Range {
  readonly words: string;
}

/** From and To for dates of one's own, taken once they make a span of 1 to 92 club days, none ahead of tonight. */
function ChosenDates({ range, today, onChange }: { range: Range; today: string; onChange: (range: Range) => void }) {
  const [from, setFrom] = useState(range.from);
  const [to, setTo] = useState(range.to);
  const isUsable = isTableSpan(from, to, today);
  const change = (next: Range) => {
    setFrom(next.from);
    setTo(next.to);
    if (isTableSpan(next.from, next.to, today)) onChange(next);
  };
  return (
    <Stack gap={2}>
      <Inline gap={4} align="start" wrap>
        <Input type="date" label={t('console.reports.tables.from')} value={from} onChange={(event) => change({ from: event.target.value, to })} />
        <Input type="date" label={t('console.reports.tables.to')} value={to} onChange={(event) => change({ from, to: event.target.value })} />
      </Inline>
      {isUsable ? null : <ErrorMessage>{t('console.reports.tables.badDates')}</ErrorMessage>}
    </Stack>
  );
}

/**
 * The period every report is read over, and its control (redesign RD-27): tonight, the last 7, 30 or 90 club days, or dates
 * of one's own. One for all the reports, so a change of report keeps the days.
 */
export function useReportPeriod(): { period: ReportPeriod; control: ReactNode } {
  const [span, setSpan] = useState<Span>('week');
  const to = clubDay(new Date());
  const [chosen, setChosen] = useState<Range>({ from: dayAfter(to, -29), to });
  const range = span === 'custom' ? chosen : { from: dayAfter(to, 1 - SPANS[span]), to };
  const words = span === 'custom' ? t('console.exportFilters.period', { from: range.from, to: range.to })
    : t('console.exportFilters.choice', { label: t('console.reports.tables.span'), value: t(`console.reports.tables.spans.${span}`) });
  const control = (
    <Stack gap={4}>
      <ChoiceChips label={t('console.reports.tables.span')} isLabelVisuallyHidden mode="one" look="subtle" selected={[span]}
        options={SPAN_KEYS.map((value) => ({ value, label: t(`console.reports.tables.spans.${value}`) }))}
        onChange={([picked]) => setSpan(SPAN_KEYS.find((value) => value === picked) ?? 'week')} />
      {span === 'custom' ? <ChosenDates range={chosen} today={to} onChange={setChosen} /> : null}
    </Stack>
  );
  return { period: { ...range, words }, control };
}
