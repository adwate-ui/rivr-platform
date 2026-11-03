import type { Meta, StoryObj } from '@storybook/react-vite';
import { Box } from '../Box/Box.tsx';
import { SeatRow } from './SeatRow.tsx';

// A seat is a row in a table's list; the list's loading and error states are the floor's.
const meta = {
  title: 'Floor/SeatRow',
  component: SeatRow,
  args: { number: 1, name: 'Nakul Dhillon', meta: '2 h 56 min', onSelect: () => undefined },
  decorators: [(Story) => <Box surface="raised" padding={2}><Story /></Box>],
} satisfies Meta<typeof SeatRow>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

/** A player asks for something: a gold dot and gold words in place of the call time. */
export const Request: Story = { args: { number: 2, name: 'Vidya Chadha', request: 'Top-up', meta: undefined } };

/** An open seat: Open, muted. */
export const Empty: Story = { args: { number: 3, name: undefined, meta: undefined } };

export const Compact: Story = { args: { density: 'compact' } };

export const LongText: Story = { args: { number: 9, name: 'Venkataraghavan Subramaniam-Krishnamurthy', request: 'Wants +1 h 30 min', meta: undefined } };
