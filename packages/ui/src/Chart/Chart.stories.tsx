import { formatMoney } from '@rivr/i18n';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { Chart, type ChartSeries } from './Chart.tsx';

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
// Rake and jackpot drop by day in rupees, fixed so screenshots match.
const WEEK: readonly ChartSeries[] = [
  { name: 'Rake', values: [42_000, 38_500, 51_000, 47_500, 88_000, 126_000, 97_500] },
  { name: 'Jackpot drop', values: [6_100, 5_400, 7_300, 6_900, 12_200, 17_800, 13_600] },
];
const rupees = (value: number) => formatMoney(BigInt(value) * 100n);

interface ChartStoryProps {
  state: 'ready' | 'loading' | 'error';
  kind: 'line' | 'bar';
  title: string;
  labelName: string;
  labels: readonly string[];
  series: readonly ChartSeries[];
  inRupees: boolean;
}

/** The chart as a screen shows it, in one of its states. */
function ChartStory({ state, kind, title, labelName, labels, series, inRupees }: ChartStoryProps) {
  if (state === 'loading') return <Chart kind={kind} title={title} labelName={labelName} status="loading" />;
  if (state === 'error') return <Chart kind={kind} title={title} labelName={labelName} status="error" onRetry={() => undefined} />;
  const format = inRupees ? { formatValue: rupees } : {};
  return <Chart kind={kind} title={title} labelName={labelName} labels={labels} series={series} emptyText="No rake this week." {...format} />;
}

const meta = {
  title: 'Data/Chart',
  component: ChartStory,
  args: { state: 'ready', kind: 'line', title: 'Rake this week', labelName: 'Day', labels: DAYS, series: WEEK, inRupees: true },
} satisfies Meta<typeof ChartStory>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Bars: Story = { args: { kind: 'bar', title: 'Rake and drop by day' } };

/** Six series, every colour in the palette, on the green it is read against. */
export const Palette: Story = {
  args: {
    kind: 'bar', title: 'Players by game', labelName: 'Hour', labels: ['20:00', '21:00', '22:00', '23:00'], inRupees: false,
    series: ['NLH 50/100', 'NLH 100/200', 'PLO 100/200', 'Private Room', 'Tournament', 'Academy'].map((name, s) => ({
      name, values: [4 + s, 9 + s, 14 - s, 11 + (s % 3)],
    })),
  },
};

export const Loading: Story = { args: { state: 'loading' } };

export const Empty: Story = { args: { series: [] } };

export const Error: Story = { args: { state: 'error' } };

/** On a phone: the words stay their size and the plot narrows; the legend wraps. */
export const Phone: Story = { tags: ['viewport-phone'], args: { kind: 'bar', title: 'Rake and drop by day' } };

/** A cage variance, short some days and over others: bars run down from the zero line. */
export const Negative: Story = {
  args: { kind: 'bar', title: 'Cash variance this week', series: [{ name: 'Variance', values: [-500, 0, 1_500, -2_000, 500, 0, -1_000] }] },
};

/** Long names wrap in the legend; a month of labels writes every third under the plot. */
export const LongText: Story = {
  args: {
    title: 'Rake at the club, every day of October, against the same month last year at the old room',
    labels: Array.from({ length: 31 }, (_, i) => String(i + 1)),
    series: [
      { name: 'This October, all tables and the Private Room together', values: Array.from({ length: 31 }, (_, i) => 40_000 + ((i * 7919) % 60) * 1_000) },
      { name: 'Last October at the old room, before the move', values: Array.from({ length: 31 }, (_, i) => 30_000 + ((i * 104_729) % 45) * 1_000) },
    ],
  },
};
