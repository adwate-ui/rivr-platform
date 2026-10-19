import type { Meta, StoryObj } from '@storybook/react-vite';
import { CallTimeTimer } from './CallTimeTimer.tsx';

const meta = {
  title: 'Floor/CallTimeTimer',
  component: CallTimeTimer,
  args: { secondsLeft: 4320 },
} satisfies Meta<typeof CallTimeTimer>;

export default meta;
type Story = StoryObj<typeof meta>;

/** An hour and 12 minutes to play in the Private Room. */
export const Default: Story = {};

/** Away from the table: the clock stands still. */
export const Paused: Story = { args: { secondsLeft: 2400, isPaused: true } };

/** Less than a minute reads as a minute. */
export const LastMinute: Story = { args: { secondsLeft: 20 } };

/** Played out: the player may leave. */
export const Done: Story = { args: { secondsLeft: 0 } };
