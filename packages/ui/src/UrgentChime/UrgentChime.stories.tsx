import type { Meta, StoryObj } from '@storybook/react-vite';
import { UrgentChime } from './UrgentChime.tsx';

// Sound and a line for a screen reader: nothing on the screen, so no loading, empty or error state of its own.
const meta = {
  title: 'Feedback/UrgentChime',
  component: UrgentChime,
  args: { counts: { topUps: 1, waitlist: 2 } },
} satisfies Meta<typeof UrgentChime>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Two join requests and a top-up waiting: it chimes only when one of them grows. */
export const Default: Story = {};
