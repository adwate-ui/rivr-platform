import type { Meta, StoryObj } from '@storybook/react-vite';
import { SeatMap } from './SeatMap.tsx';

// The map draws what the floor says; the join sheet around it carries any loading or error state.
const meta = {
  title: 'Data/SeatMap',
  component: SeatMap,
  args: { openSeats: [2, 4, 7], label: '3 of 9 seats open' },
} satisfies Meta<typeof SeatMap>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Full: Story = { args: { openSeats: [], label: '0 of 9 seats open' } };

export const Empty: Story = { args: { openSeats: [1, 2, 3, 4, 5, 6, 7, 8, 9], label: '9 of 9 seats open' } };

export const TenSeats: Story = { args: { seatCount: 10, openSeats: [10], label: '1 of 10 seats open' } };
