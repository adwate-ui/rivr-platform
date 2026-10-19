import type { Meta, StoryObj } from '@storybook/react-vite';
import { SeatRing, type RingSeat } from './SeatRing.tsx';

function seats(count: number, taken: Record<number, string>): RingSeat[] {
  return Array.from({ length: count }, (_, index) => ({ number: index + 1, initials: taken[index + 1] ?? null }));
}

// A table has no loading or error state of its own: the live floor says when it cannot load. An
// empty table is the empty story.
const meta = {
  title: 'Floor/SeatRing',
  component: SeatRing,
  decorators: [(Story) => <div className="w-80 bg-raised p-4"><Story /></div>],
  args: {
    name: 'Table 1',
    stakes: '50/100',
    seats: seats(9, { 1: 'RV', 2: 'SM', 3: 'NB', 5: 'PR', 6: 'AS', 8: 'KS' }),
    label: 'Table 1, 6 of 9 seats taken',
  },
} satisfies Meta<typeof SeatRing>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Full: Story = {
  args: { name: 'Table 2', stakes: '100/200', seats: seats(9, { 1: 'YG', 2: 'RS', 3: 'MK', 4: 'ZK', 5: 'PD', 6: 'AR', 7: 'VN', 8: 'TD', 9: 'OS' }), label: 'Table 2, 9 of 9 seats taken' },
};

export const Empty: Story = { args: { name: 'Table 5', stakes: '100/200', seats: seats(9, {}), label: 'Table 5, no seats taken' } };

export const Closed: Story = { args: { name: 'Table 4', stakes: '100/200', seats: seats(9, {}), label: 'Table 4, closed', isClosed: true } };

export const TenSeats: Story = { args: { name: 'Table 6', stakes: '25/50', seats: seats(10, { 1: 'AB', 10: 'YZ' }), label: 'Table 6, 2 of 10 seats taken' } };

/** On the dealer tablet: each seat a button with its number under it, seat 8 chosen (#59). */
export const Selectable: Story = {
  args: { name: 'Table 3', stakes: '100/200', selectedSeat: 8, onSelectSeat: () => undefined, label: 'Table 3',
    seats: seats(9, { 1: 'VR', 2: 'DM', 3: 'IC', 4: 'MI', 5: 'TA', 6: 'SJ', 7: 'AK', 8: 'FQ' }) },
};

export const LongText: Story = { args: { name: 'Private Room', stakes: '100/200 · ₹500 straddle', label: 'Private Room, 6 of 9 seats taken' } };
