import type { Meta, StoryObj } from '@storybook/react-vite';
import { Inline } from '../Inline/Inline.tsx';
import { Stack } from '../Stack/Stack.tsx';
import { Text } from '../Text/Text.tsx';
import { Spacer } from './Spacer.tsx';

const meta = {
  title: 'Layout/Spacer',
  component: Spacer,
} satisfies Meta<typeof Spacer>;

export default meta;
type Story = StoryObj<typeof meta>;

/** A flexible spacer pushes the amount to the end of the row. */
export const Default: Story = {
  render: () => (
    <Inline gap={0}>
      <Text>Cash</Text>
      <Spacer />
      <Text tone="money">₹1,20,000</Text>
    </Inline>
  ),
};

export const FixedStep: Story = {
  render: () => (
    <Stack gap={0}>
      <Text>Balance</Text>
      <Spacer size={8} />
      <Text tone="muted">Movements</Text>
    </Stack>
  ),
};

export const LongText: Story = {
  render: () => (
    <Inline gap={0} align="start">
      <Text>Bonus from the opening-night promotion, released after ten hours of play</Text>
      <Spacer size={4} />
      <Text tone="money">₹4,000</Text>
    </Inline>
  ),
};

export const Hindi: Story = {
  globals: { locale: 'hi' },
  render: () => (
    <Inline gap={0}>
      <Text>नकद</Text>
      <Spacer />
      <Text tone="money">₹1,20,000</Text>
    </Inline>
  ),
};
