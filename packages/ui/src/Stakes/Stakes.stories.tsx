import type { Meta, StoryObj } from '@storybook/react-vite';
import { Inline } from '../Inline/Inline.tsx';
import { Text } from '../Text/Text.tsx';
import { Stakes } from './Stakes.tsx';

const meta = {
  title: 'Type/Stakes',
  component: Stakes,
  args: { smallBlind: 10_000n, bigBlind: 20_000n },
} satisfies Meta<typeof Stakes>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const PrivateRoom: Story = { args: { smallBlind: 100_000n, bigBlind: 200_000n, size: 'lead' } };

export const LongText: Story = { args: { smallBlind: 1_000_000n, bigBlind: 2_000_000n, size: 'display' } };

export const Hindi: Story = {
  globals: { locale: 'hi' },
  render: () => (
    <Inline gap={3} align="baseline">
      <Text>टेबल 3</Text>
      <Stakes smallBlind={10_000n} bigBlind={20_000n} tone="muted" />
    </Inline>
  ),
};
