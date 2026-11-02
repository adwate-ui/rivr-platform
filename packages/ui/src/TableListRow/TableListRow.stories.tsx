import type { Meta, StoryObj } from '@storybook/react-vite';
import { TableListRow } from './TableListRow.tsx';

// A row shows one table; the tables sheet around it carries the loading, empty and error states.
const meta = {
  title: 'Data/TableListRow',
  component: TableListRow,
  args: { name: 'Table 1 · NLH 50/100', openSeats: 3, wait: 'No wait', isNoWait: true, seatsLine: '3 open', onOpen: () => undefined },
} satisfies Meta<typeof TableListRow>;

export default meta;
type Story = StoryObj<typeof meta>;

export const NoWait: Story = {};

export const Waiting: Story = { args: { name: 'Table 2 · NLH 100/200', openSeats: 0, wait: '3 waiting', isNoWait: false, seatsLine: 'Full' } };

export const Closed: Story = { args: { name: 'Table 4 · NLH 100/200', openSeats: 0, wait: 'Closed', isNoWait: false, seatsLine: 'Opens later', isClosed: true } };

export const LongText: Story = { args: { name: "Private Room · No-Limit Hold'em 1,000/2,000 with a straddle" } };
