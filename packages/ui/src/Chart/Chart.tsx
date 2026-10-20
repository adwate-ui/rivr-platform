import { t } from '@rivr/i18n';
import { Button } from '../Button/Button.tsx';
import { Text } from '../Text/Text.tsx';

/** One series: its name, in the legend and to screen readers, and a value for each label. */
export interface ChartSeries {
  readonly name: string;
  readonly values: readonly number[];
}

type ChartState =
  | { status?: 'ready'; labels: readonly string[]; series: readonly ChartSeries[]; /** When there is nothing to draw. */ emptyText: string }
  | { status: 'loading' }
  | { status: 'error'; /** What happened, then what to do. Defaults to the shared load error. */ errorText?: string; onRetry?: () => void };

export type ChartProps = ChartState & {
  /** A line across the labels, or bars side by side for each label. */
  kind: 'line' | 'bar';
  /** What the chart shows: its caption, and the name of the table screen readers get. */
  title: string;
  /** What the labels are, such as Day: the header of that table's first column. */
  labelName: string;
  /** How a value reads in that table and on the scale, such as money; the plain number otherwise. */
  formatValue?: (value: number) => string;
};

// The token chart palette, in order (color.chart, each 3:1 or better on green): six series at most.
const FILLS = ['fill-chart-1', 'fill-chart-2', 'fill-chart-3', 'fill-chart-4', 'fill-chart-5', 'fill-chart-6'] as const;
const STROKES = ['stroke-chart-1', 'stroke-chart-2', 'stroke-chart-3', 'stroke-chart-4', 'stroke-chart-5', 'stroke-chart-6'] as const;
const SWATCHES = ['bg-chart-1', 'bg-chart-2', 'bg-chart-3', 'bg-chart-4', 'bg-chart-5', 'bg-chart-6'] as const;
const MOST_SERIES = FILLS.length;

// The plot's own units, stretched to the container: strokes keep their width, and every word on the chart is
// HTML text, so it reads the same on a phone as on the console.
const WIDTH = 640;
const HEIGHT = 200;
// At most this many labels are written under the plot; every value is in the screen readers' table.
const MOST_LABELS = 12;

interface Drawing {
  readonly kind: ChartProps['kind'];
  readonly labels: readonly string[];
  readonly series: readonly ChartSeries[];
  /** The scale runs from the lowest value or zero, whichever is lower, to the highest or zero. */
  readonly min: number;
  readonly max: number;
}

const yOf = (value: number, { min, max }: Drawing) => HEIGHT * (1 - (value - min) / (max - min || 1));

function Bars(drawing: Drawing) {
  const group = WIDTH / drawing.labels.length;
  const bar = (group * 0.7) / drawing.series.length;
  const zero = yOf(0, drawing);
  return drawing.series.map((line, s) => (
    <g key={s} className={FILLS[s]}>
      {drawing.labels.map((_, i) => {
        const y = yOf(line.values[i] ?? 0, drawing);
        return <rect key={i} x={i * group + group * 0.15 + s * bar} y={Math.min(y, zero)} width={Math.max(bar - 2, 1)} height={Math.abs(zero - y)} />;
      })}
    </g>
  ));
}

function Lines(drawing: Drawing) {
  const group = WIDTH / drawing.labels.length;
  return drawing.series.map((line, s) => (
    <polyline key={s} fill="none" strokeWidth={2} vectorEffect="non-scaling-stroke" className={STROKES[s]}
      points={drawing.labels.map((_, i) => `${(i + 0.5) * group},${yOf(line.values[i] ?? 0, drawing)}`).join(' ')} />
  ));
}

/** The plot: the scale's top written above it, hairlines with zero among them, the series, and the labels under it. */
function Plot({ drawing, formatValue }: { drawing: Drawing; formatValue: (value: number) => string }) {
  const step = Math.ceil(drawing.labels.length / MOST_LABELS);
  const lines = [...[0, 1, 2, 3].map((n) => (HEIGHT * n) / 3), yOf(0, drawing)];
  return (
    <div className="flex flex-col gap-1" aria-hidden="true">
      {drawing.max > 0 ? <Text variant="small" tone="muted">{formatValue(drawing.max)}</Text> : null}
      <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} preserveAspectRatio="none" className="h-chart w-full overflow-visible">
        {lines.map((y, n) => <line key={n} x1={0} x2={WIDTH} y1={y} y2={y} strokeWidth={1} vectorEffect="non-scaling-stroke" className="stroke-hairline" />)}
        {drawing.kind === 'bar' ? <Bars {...drawing} /> : <Lines {...drawing} />}
      </svg>
      {drawing.min < 0 ? <Text variant="small" tone="muted">{formatValue(drawing.min)}</Text> : null}
      <div className="flex">
        {drawing.labels.map((label, i) => (
          <span key={i} className="min-w-0 flex-1 text-center">{i % step === 0 ? <Text variant="small" tone="muted">{label}</Text> : null}</span>
        ))}
      </div>
    </div>
  );
}

/** Every value, in a table only screen readers get: the chart itself is a picture of it. */
function ValuesTable({ title, labelName, labels, series, formatValue }: {
  title: string; labelName: string; labels: readonly string[]; series: readonly ChartSeries[]; formatValue: (value: number) => string;
}) {
  return (
    <table className="sr-only">
      <caption>{title}</caption>
      <thead><tr><th scope="col">{labelName}</th>{series.map((line, s) => <th key={s} scope="col">{line.name}</th>)}</tr></thead>
      <tbody>
        {labels.map((label, i) => (
          <tr key={i}><th scope="row">{label}</th>{series.map((line, s) => <td key={s}>{formatValue(line.values[i] ?? 0)}</td>)}</tr>
        ))}
      </tbody>
    </table>
  );
}

/** Each series' colour and name, in the palette's order. */
function Legend({ series }: { series: readonly ChartSeries[] }) {
  return (
    <ul className="flex flex-wrap gap-x-4 gap-y-1" aria-hidden="true">
      {series.map((line, s) => (
        <li key={s} className="flex items-center gap-2">
          <span className={`size-3 shrink-0 rounded-sm ${SWATCHES[s] ?? ''}`} />
          <Text variant="small" tone="muted">{line.name}</Text>
        </li>
      ))}
    </ul>
  );
}

/** What stands in for the chart: loading, the error with a retry, or why there is nothing to draw. */
function Instead({ props }: { props: ChartProps }) {
  if (props.status === 'loading') return <div role="status" className="py-4"><Text tone="muted">{t('common.loading')}</Text></div>;
  if (props.status === 'error') {
    return (
      <div role="alert" className="flex flex-col items-start gap-3 py-4">
        <Text>{props.errorText ?? t('common.loadFailed')}</Text>
        {props.onRetry ? <Button onClick={props.onRetry}>{t('common.retry')}</Button> : null}
      </div>
    );
  }
  return <div role="status" className="py-4"><Text tone="muted">{props.emptyText}</Text></div>;
}

/**
 * A line or bar chart (#90), coloured only from the token chart palette, which reads on green; up to six series
 * (any more are left out). The picture is hidden from screen readers, which get every value in a table named by
 * the title instead, so the title is read once, there.
 */
export function Chart(props: ChartProps) {
  const formatValue = props.formatValue ?? ((value: number) => String(value));
  const series = props.status === 'loading' || props.status === 'error' ? [] : props.series.slice(0, MOST_SERIES);
  const labels = props.status === 'loading' || props.status === 'error' ? [] : props.labels;
  const values = series.flatMap((line) => line.values);
  return (
    <figure className="flex flex-col gap-3">
      <figcaption aria-hidden="true"><Text weight="semibold">{props.title}</Text></figcaption>
      {labels.length > 0 && series.length > 0 ? (
        <>
          <Plot drawing={{ kind: props.kind, labels, series, min: Math.min(0, ...values), max: Math.max(0, ...values) }} formatValue={formatValue} />
          <Legend series={series} />
          <ValuesTable title={props.title} labelName={props.labelName} labels={labels} series={series} formatValue={formatValue} />
        </>
      ) : <Instead props={props} />}
    </figure>
  );
}
