import type { Meta, StoryObj } from '@storybook/react-vite';
import { StaleNotice } from './StaleNotice.tsx';

const meta = {
  title: 'Feedback/StaleNotice',
  component: StaleNotice,
  args: { since: new Date('2026-11-15T20:42:00+05:30') },
} satisfies Meta<typeof StaleNotice>;

export default meta;
type Story = StoryObj<typeof meta>;

// No loading, empty or error story: the notice is itself the state of a screen that had data and lost its refresh.
export const Default: Story = { args: { onRetry: () => undefined } };

/** Without Try again. */
export const WithoutRetry: Story = {};

/** On a TV, read across a room: its body size, muted, with nothing to press (F3-24). */
export const OnTv: Story = { args: { variant: 'tv' } };
