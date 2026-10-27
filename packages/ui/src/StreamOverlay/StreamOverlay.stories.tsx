import type { Meta, StoryObj } from '@storybook/react-vite';
import { KillSwitchBanner } from '../KillSwitchBanner/KillSwitchBanner.tsx';
import { StreamOverlay } from './StreamOverlay.tsx';

const meta = {
  title: 'TV/StreamOverlay',
  component: StreamOverlay,
  tags: ['viewport-tv'],
  parameters: { layout: 'fullscreen' },
  args: {
    clock: {
      name: 'RIVR Sunday',
      level: 'Level 18',
      remaining: '11:29',
      blinds: '4,000/8,000',
      ante: 'Ante 8,000',
      next: 'Next 5,000/10,000 ante 10,000',
      stats: [
        { label: 'Players', value: '9' },
        { label: 'Entries', value: '58' },
        { label: 'Average', value: '1,93,333' },
        { label: 'Pool', value: '₹5,22,000' },
      ],
    },
  },
} satisfies Meta<typeof StreamOverlay>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

/** Paused by the floor: the clock holds and says so. */
export const Paused: Story = { args: { clock: { ...meta.args.clock, status: 'Paused' } } };

/** Nothing to show yet, nothing running, still loading or unable to read: the stream sees nothing. */
export const Empty: Story = { args: { clock: undefined, statusText: 'No tournament is running.' } };

/** The venue is frozen: the banner stays above the clock. */
export const Frozen: Story = { args: { banner: <KillSwitchBanner audience="member" /> } };

export const LongText: Story = {
  args: {
    clock: {
      name: 'RIVR Monsoon Main Event Day 2 Final Table',
      level: 'Break after level 24',
      remaining: '59:59',
      status: 'Paused',
      blinds: '25,000/50,000',
      ante: 'Ante 50,000',
      next: 'Next 30,000/60,000 ante 60,000',
      stats: [
        { label: 'Players', value: '1,204' },
        { label: 'Entries', value: '2,310' },
        { label: 'Average', value: '12,45,600' },
        { label: 'Pool', value: '₹1,15,50,000' },
      ],
    },
  },
};
