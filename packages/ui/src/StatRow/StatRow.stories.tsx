import type { Meta, StoryObj } from '@storybook/react-vite';
import { StatRow } from './StatRow.tsx';

// A stat row shows figures it is given; the screen around it carries any loading or error state.
const meta = {
  title: 'Data/StatRow',
  component: StatRow,
  args: { stats: [{ label: 'This month', value: '2' }, { label: 'Hours played', value: '6h 30m' }] },
} satisfies Meta<typeof StatRow>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const JoinSheet: Story = {
  args: { size: 'medium', stats: [{ label: 'Seats open', value: '3 of 9' }, { label: 'Waiting', value: 'None' }, { label: 'Call time', value: '3 h' }] },
};
