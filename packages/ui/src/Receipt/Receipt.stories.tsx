import type { Meta, StoryObj } from '@storybook/react-vite';
import { Receipt } from './Receipt.tsx';

// A receipt is a static render for @rivr/render and the printer: it has no loading, empty or error state.
const meta = {
  title: 'Paper/Receipt',
  component: Receipt,
  args: {
    issuer: { legalName: 'RIVR Hospitality LLP', address: 'Upper floor, Glaza, M3M 65th Avenue, Gurugram', gstin: '06AAAAA0000A1Z5' },
    title: 'Cash-out',
    at: 'Sat 13 Feb, 03:40',
    lines: [
      { label: 'Table', value: 'Table 2, seat 4' },
      { label: 'Stake', value: '100/200' },
      { label: 'Buy-in', value: 2_000_000n },
      { label: 'Cash-out', value: 4_650_000n },
    ],
    total: { label: 'Paid to cash', paise: 4_650_000n },
    reference: 'Receipt RV-0213-0418',
  },
} satisfies Meta<typeof Receipt>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

/** A receipt with nothing to total, such as a buy-in on account; a club without a GSTIN prints none. */
export const WithoutTotal: Story = {
  args: { total: undefined, issuer: { legalName: 'RIVR Hospitality LLP', address: 'Upper floor, Glaza, M3M 65th Avenue, Gurugram' } },
};

/** At the practice venue, the receipt says so beneath when. */
export const Practice: Story = { args: { notice: 'Practice receipt. No money changed hands.' } };

export const LongText: Story = {
  args: {
    title: 'Tournament prize, RIVR Sunday',
    lines: [
      { label: 'Prize, 4th of 61', value: 4_860_000n },
      { label: 'TDS, 30% of net winnings over the threshold', value: -1_158_000n },
    ],
    total: { label: 'Paid to cash', paise: 3_702_000n },
  },
};
