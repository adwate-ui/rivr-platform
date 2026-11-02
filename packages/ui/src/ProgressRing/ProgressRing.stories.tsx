import type { Meta, StoryObj } from '@storybook/react-vite';
import { Text } from '../Text/Text.tsx';
import { ProgressRing } from './ProgressRing.tsx';

// The ring draws a clock it is given; the seat around it carries any loading or error state.
const meta = {
  title: 'Data/ProgressRing',
  component: ProgressRing,
  args: { fraction: 0.9, children: <Text variant="small" tone="muted">call time left · ends 01:44</Text> },
} satisfies Meta<typeof ProgressRing>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Ending: Story = { args: { fraction: 0.08, tone: 'alert' } };

export const Done: Story = { args: { fraction: 0 } };
