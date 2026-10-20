import type { Meta, StoryObj } from '@storybook/react-vite';
import { DisplayShell } from '../DisplayShell/DisplayShell.tsx';
import { TvTournamentClock } from './TvTournamentClock.tsx';

const meta = {
  title: 'TV/TvTournamentClock',
  component: TvTournamentClock,
  tags: ['viewport-tv'],
  parameters: { layout: 'fullscreen' },
  decorators: [(Story) => <DisplayShell><Story /></DisplayShell>],
  args: {
    name: 'RIVR Sunday',
    level: 'Level 7',
    remaining: '11:29',
    blinds: '400/800',
    ante: 'Ante 800',
    next: 'Next 500/1,000 ante 1,000',
    stats: [
      { label: 'Players', value: '31' },
      { label: 'Entries', value: '58' },
      { label: 'Average', value: '56,129' },
      { label: 'Pool', value: '₹5,22,000' },
    ],
    payoutsLabel: 'Payouts',
    payouts: [
      { place: '1', amount: 15_660_000n }, { place: '2', amount: 10_440_000n }, { place: '3', amount: 7_308_000n },
      { place: '4', amount: 5_220_000n }, { place: '5', amount: 4_176_000n }, { place: '6', amount: 3_654_000n },
      { place: '7', amount: 3_132_000n }, { place: '8', amount: 2_610_000n },
    ],
    noPayoutsText: 'Payouts are set when registration closes.',
  },
} satisfies Meta<typeof TvTournamentClock>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

/** Paused by the floor: the clock holds and says so. */
export const Paused: Story = { args: { status: 'Paused' } };

/** Registration still open: no payouts yet. */
export const Empty: Story = { args: { payouts: [], ante: undefined, level: 'Level 1', remaining: '20:00', blinds: '100/200' } };

/** A big field: fifteen paid places, of which the stage shows the first nine. */
export const Full: Story = {
  args: {
    payouts: Array.from({ length: 15 }, (_, index) => ({ place: String(index + 1), amount: BigInt(20_000_000 - index * 1_000_000) })),
  },
};

export const LongText: Story = {
  args: {
    name: 'RIVR Monsoon Main Event Day 2',
    level: 'Level 24',
    remaining: '59:59',
    blinds: '25,000/50,000',
    ante: 'Ante 50,000',
    next: undefined,
    stats: [
      { label: 'Players', value: '1,204' },
      { label: 'Entries', value: '2,310' },
      { label: 'Average', value: '12,45,600' },
      { label: 'Pool', value: '₹1,15,50,000' },
    ],
  },
};
