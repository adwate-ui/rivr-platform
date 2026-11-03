import type { Meta, StoryObj } from '@storybook/react-vite';
import { ProgressBar } from './ProgressBar.tsx';

// A bar draws a fraction it is given; it has no loading, empty or error state of its own.
const meta = {
  title: 'Data/ProgressBar',
  component: ProgressBar,
  args: { fraction: 0.65 },
} satisfies Meta<typeof ProgressBar>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Hold: Story = { args: { width: 'hold', fraction: 0.98 } };

export const Empty: Story = { args: { fraction: 0 } };

/** A call time running, on the console's player sheet: cream, as it needs nobody (decision 0463). */
export const Muted: Story = { args: { tone: 'muted', fraction: 0.35 } };
