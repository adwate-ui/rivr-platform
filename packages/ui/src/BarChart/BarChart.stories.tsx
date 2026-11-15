import type { Meta, StoryObj } from '@storybook/react-vite';
import { BarChart } from './BarChart.tsx';

const SEATED = [9, 17, 26, 33, 38, 41, 39, 34, 30, 22];
const HOURS = ['18', '19', '20', '21', '22', '23', '00', '01', '02', '03'];

// A chart draws the bars it is given; the report around it carries any loading or error state.
const meta = {
  title: 'Data/BarChart',
  component: BarChart,
  args: { label: 'Seated by hour', bars: SEATED.map((value, index) => ({ label: HOURS[index] ?? '', value, valueText: String(value) })) },
} satisfies Meta<typeof BarChart>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

/** A whole club day: twenty-four hours, most of them quiet. */
export const ClubDay: Story = {
  args: {
    label: 'Orders by hour',
    bars: Array.from({ length: 24 }, (_, hour) => {
      const value = hour < 11 ? 0 : (hour - 10) * 3 % 17;
      return { label: String((hour + 6) % 24).padStart(2, '0'), value, valueText: String(value) };
    }),
  },
};

/** Ninety days: the bars stand close, and a line under them names every few. */
export const NinetyDays: Story = {
  args: {
    label: 'Check-ins by day',
    bars: Array.from({ length: 90 }, (_, day) => {
      const value = 20 + (day * 7) % 31;
      return { label: `${String((day % 30) + 1)} ${['Sep', 'Oct', 'Nov'][Math.floor(day / 30)] ?? ''}`, value, valueText: String(value) };
    }),
  },
};

/** Times and long figures over the bars. */
export const LongText: Story = {
  args: { label: 'Bonus given by hour', bars: SEATED.map((value, index) => ({ label: HOURS[index] ?? '', value, valueText: `${String(value)},500` })) },
};

export const Empty: Story = { args: { label: 'Orders by hour', bars: SEATED.map((_, index) => ({ label: HOURS[index] ?? '', value: 0, valueText: '0' })) } };

/** One bar: a report of a single hour or day. */
export const OneBar: Story = { args: { label: 'Bonus given by day', bars: [{ label: '15 Nov', value: 26_500, valueText: '26,500' }] } };
