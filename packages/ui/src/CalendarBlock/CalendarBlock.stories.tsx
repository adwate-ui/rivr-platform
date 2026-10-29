import type { Meta, StoryObj } from '@storybook/react-vite';
import { CalendarBlock } from './CalendarBlock.tsx';

const meta = {
  title: 'Website/CalendarBlock',
  component: CalendarBlock,
  tags: ['viewport-console'],
  parameters: { layout: 'fullscreen' },
  args: {
    heading: 'Tournaments',
    tournaments: [
      { name: 'RIVR Sunday', startsAt: new Date('2026-11-15T10:30:00Z'), buyIn: 1000000n, guarantee: 50000000n },
      { name: 'Tuesday Turbo', startsAt: new Date('2026-11-17T14:30:00Z'), buyIn: 300000n, guarantee: null },
    ],
  },
} satisfies Meta<typeof CalendarBlock>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Empty: Story = { args: { tournaments: [] } };

/** With the month day by day above the list (#617). */
export const WithMonth: Story = { args: { month: '2026-11' } };

export const WithMonthOnAPhone: Story = { tags: ['!viewport-console', 'viewport-phone'], args: { month: '2026-11' } };

export const LongText: Story = {
  args: {
    tournaments: [
      {
        name: 'RIVR Sunday Main Event, Day 1A, re-entry to the end of level 9',
        startsAt: new Date('2026-11-15T10:30:00Z'),
        buyIn: 2500000n,
        guarantee: 250000000n,
      },
    ],
  },
};
