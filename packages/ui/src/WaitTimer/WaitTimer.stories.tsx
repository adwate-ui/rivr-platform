import type { Meta, StoryObj } from '@storybook/react-vite';
import { WaitTimer } from './WaitTimer.tsx';

// A figure the screen passes in: no loading, empty or error state of its own.
const meta = {
  title: 'Floor/WaitTimer',
  component: WaitTimer,
  args: { seconds: 42, isLate: false },
} satisfies Meta<typeof WaitTimer>;

export default meta;
type Story = StoryObj<typeof meta>;

/** A top-up asked for 42 seconds ago: in time. */
export const InTime: Story = {};

/** Past the minute: late, in red. */
export const Late: Story = { args: { seconds: 95, isLate: true } };

/** A long wait, over an hour. */
export const VeryLate: Story = { args: { seconds: 3725, isLate: true } };
