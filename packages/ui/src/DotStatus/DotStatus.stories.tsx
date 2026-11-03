import type { Meta, StoryObj } from '@storybook/react-vite';
import { Stack } from '../Stack/Stack.tsx';
import { DotStatus } from './DotStatus.tsx';

// A status always has words, so there is no loading, empty or error state of its own: its row or table shows those.
const meta = {
  title: 'Data/DotStatus',
  component: DotStatus,
  tags: ['viewport-console'],
  args: { tone: 'active', label: 'Waiting' },
} satisfies Meta<typeof DotStatus>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

/** Gold only for what waits on the staff member; the rest cream, faint or the danger red. */
export const EveryTone: Story = {
  render: () => (
    <Stack gap={3}>
      <DotStatus tone="needsYou" label="Asks to join" />
      <DotStatus tone="active" label="Waiting" />
      <DotStatus tone="inactive" label="Left" />
      <DotStatus tone="danger" label="KYC pending" />
    </Stack>
  ),
};

/** A short label in a table cell, its full words in the tooltip and for a screen reader. */
export const ShortWithTitle: Story = { args: { tone: 'needsYou', label: 'T2 · 3', title: 'Table 2, seat 3' } };

export const LongText: Story = { args: { tone: 'danger', label: 'KYC pending since Saturday: the selfie did not match the document photo' } };
