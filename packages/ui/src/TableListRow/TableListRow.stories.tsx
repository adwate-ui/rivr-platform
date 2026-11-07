import type { Meta, StoryObj } from '@storybook/react-vite';
import { TableListRow } from './TableListRow.tsx';

// A row shows one table; the tables sheet around it carries the loading, empty and error states.
const meta = {
  title: 'Data/TableListRow',
  component: TableListRow,
  args: { name: 'Table 1 · NLH 50/100', detail: 'Min buy-in ₹5,000', wait: 'No wait', isNoWait: true, onOpen: () => undefined },
} satisfies Meta<typeof TableListRow>;

export default meta;
type Story = StoryObj<typeof meta>;

export const NoWait: Story = {};

export const Waiting: Story = { args: { name: 'Table 2 · NLH 100/200', detail: 'Min buy-in ₹10,000', wait: '3 waiting', isNoWait: false, seatsLine: 'Full' } };

export const Closed: Story = {
  args: { name: 'Table 4 · NLH 100/200', detail: 'Min buy-in ₹10,000', wait: 'Closed', isNoWait: false, seatsLine: 'Opens later', isClosed: true },
};

export const LongText: Story = { args: { name: "Private Room · No-Limit Hold'em 1,000/2,000 with a straddle", detail: 'Min buy-in ₹1,00,000' } };

/** As the player app shows a table (owner, 8 Nov): its stakes and buy-in, and nothing of seats or the wait. */
export const StakesOnly: Story = { args: { name: 'Table 5 · NLH 100/200/400', detail: 'Min buy-in ₹10,000', wait: undefined, isNoWait: false } };
