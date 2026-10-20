import { documents, registerMessages } from '@rivr/i18n';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { ThermalReceipt } from './ThermalReceipt.tsx';

// A receipt is a static render for @rivr/render and the printer: it has no loading, empty or error state.
registerMessages({ documents });

const meta = {
  title: 'Paper/ThermalReceipt',
  component: ThermalReceipt,
  args: {
    issuer: { legalName: 'RIVR Hospitality LLP', address: 'Upper floor, Glaza, M3M 65th Avenue, Gurugram', gstin: '06AAAAA0000A1Z5' },
    isPractice: false,
    title: 'Buy-in',
    // 23:10 IST on Tuesday 20 October 2026.
    at: '2026-10-20T17:40:00Z',
    lines: [
      { label: 'Member', value: 'Vihaan Kapoor' },
      { label: 'Paid by', value: 'Cash' },
    ],
    total: { label: 'Chips issued', paise: 500_000n },
    reference: '7F3A92C1',
  },
} satisfies Meta<typeof ThermalReceipt>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

/** At the practice venue, the receipt says it is a practice one. */
export const Practice: Story = { args: { isPractice: true, issuer: { legalName: 'RIVR Hospitality LLP', address: 'Training room' } } };

export const LongText: Story = {
  args: {
    title: 'Cash-out',
    lines: [
      { label: 'Member', value: 'Vihaan Aditya Kapoor-Mehrotra' },
      { label: 'Chips handed back', value: 4_650_000n },
      { label: 'Markers settled', value: 1_000_000n },
      { label: 'TDS withheld', value: 51_000n },
    ],
    total: { label: 'Paid to cash', paise: 3_599_000n },
  },
};
