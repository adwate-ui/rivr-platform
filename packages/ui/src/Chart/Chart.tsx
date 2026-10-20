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
  /** How a value reads in that table and at the top of the scale, such as money; the plain number otherwise. */
  formatValue?: (value: number) => string;
};

// The token chart palette, in order (color.chart, each 3:1 or better on green); a seventh series takes the first again.
const FILLS = ['fill-chart-1', 'fill-chart-2', 'fill-chart-3', 'fill-chart-4', 'fill-chart-5', 'fill-chart-6'] as const;
const STROKES = ['stroke-chart-1', 'stroke-chart-2', 'stroke-chart-3', 'stroke-chart-4', 'stroke-chart-5', 'stroke-chart-6'] as const;
const SWATCHES = ['bg-chart-1', 'bg-chart-2', 'bg-chart-3', 'bg-chart-4', 'bg-chart-5', 'bg-chart-6'] as const;
const colour = <T,>(palette: readonly T[], index: number): T | undefined => palette[index % palette.length];

// The drawing's own units; the SVG scales to its container's width.
const WIDTH = 640;
const HEIGHT = 240;
const TOP = 20;
const BOTTOM = 28;
const PLOT = HEIGHT - TOP - BOTTOM;
// At most this many labels are written under the plot; the rest are in the screen readers' table.
const MOST_LABELS = 12;

interface Drawing {
  readonly kind: ChartProps['kind'];
  readonly labels: readonly string[];
  readonly series: readonly ChartSeries[];
  readonly max: number;
}

const yOf = (value: number, max: number) => TOP + PLOT * (1 - Math.max(value, 0) / max);

function Bars({ labels, series, max }: Drawing) {
  const group = WIDTH / labels.length;
  const bar = (group * 0.7) / series.length;
  return series.map((line, s) => (
    <g key={line.name} className={colour(FILLS, s)}>
      {labels.map((label, i) => {
        const y = yOf(line.values[i] ?? 0, max);
        return <rect key={label} x={i * group + group * 0.15 + s * bar} y={y} width={Math.max(bar - 2, 1)} height={TOP + PLOT - y} rx={2} />;
      })}
    </g>
  ));
}

function Lines({ labels, series, max }: Drawing) {
  const group = WIDTH / labels.length;
  return series.map((line, s) => {
    const points = labels.map((_, i) => ({ x: (i + 0.5) * group, y: yOf(line.values[i] ?? 0, max) }));
    return (
      <g key={line.name}>
        <polyline points={points.map((p) => `${p.x},${p.y}`).join(' ')} fill="none" strokeWidth={2} className={colour(STROKES, s)} />
        {points.map((p, i) => <circle key={labels[i]} cx={p.x} cy={p.y} r={3} className={colour(FILLS, s)} />)}
      </g>
    );
  });
}

/** The plot: four hairlines up to the largest value, written at the top, then the series and the labels under them. */
function Plot({ drawing, formatValue }: { drawing: Drawing; formatValue: (value: number) => string }) {
  const step = Math.ceil(drawing.labels.length / MOST_LABELS);
  const group = WIDTH / drawing.labels.length;
  return (
    <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} className="w-full" aria-hidden="true">
      {[0, 1, 2, 3].map((n) => <line key={n} x1={0} x2={WIDTH} y1={TOP + (PLOT * n) / 3} y2={TOP + (PLOT * n) / 3} strokeWidth={1} className="stroke-hairline" />)}
      <text x={0} y={TOP - 6} className="fill-content-muted font-text text-12">{formatValue(drawing.max)}</text>
      {drawing.kind === 'bar' ? <Bars {...drawing} /> : <Lines {...drawing} />}
      {drawing.labels.map((label, i) => (i % step === 0 ? (
        <text key={label} x={(i + 0.5) * group} y={HEIGHT - 8} textAnchor="middle" className="fill-content-muted font-text text-12">{label}</text>
      ) : null))}
    </svg>
  );
}

/** Every value, in a table only screen readers get: the chart itself is a picture of it. */
function ValuesTable({ title, labelName, labels, series, formatValue }: {
  title: string; labelName: string; labels: readonly string[]; series: readonly ChartSeries[]; formatValue: (value: number) => string;
}) {
  return (
    <table className="sr-only">
      <caption>{title}</caption>
      <thead><tr><th scope="col">{labelName}</th>{series.map((line) => <th key={line.name} scope="col">{line.name}</th>)}</tr></thead>
      <tbody>
        {labels.map((label, i) => (
          <tr key={label}><th scope="row">{label}</th>{series.map((line) => <td key={line.name}>{formatValue(line.values[i] ?? 0)}</td>)}</tr>
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
        <li key={line.name} className="flex items-center gap-2">
          <span className={`size-3 rounded-sm ${colour(SWATCHES, s) ?? ''}`} />
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
 * A line or bar chart (#90), coloured only from the token chart palette, which reads on green. The picture is
 * hidden from screen readers, which get every value in a table named by the title instead.
 */
export function Chart(props: ChartProps) {
  const formatValue = props.formatValue ?? ((value: number) => String(value));
  const isDrawn = props.status !== 'loading' && props.status !== 'error' && props.labels.length > 0 && props.series.length > 0;
  return (
    <figure className="flex flex-col gap-3">
      <figcaption><Text weight="semibold">{props.title}</Text></figcaption>
      {isDrawn ? (
        <>
          <Plot drawing={{ kind: props.kind, labels: props.labels, series: props.series, max: Math.max(1, ...props.series.flatMap((line) => line.values)) }}
            formatValue={formatValue} />
          <Legend series={props.series} />
          <ValuesTable title={props.title} labelName={props.labelName} labels={props.labels} series={props.series} formatValue={formatValue} />
        </>
      ) : <Instead props={props} />}
    </figure>
  );
}
