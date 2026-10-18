import type { Meta, StoryObj } from '@storybook/react-vite';
import { Inline } from '../Inline/Inline.tsx';
import { Stack } from '../Stack/Stack.tsx';
import { Text } from '../Text/Text.tsx';
import { Divider } from './Divider.tsx';

const meta = {
  title: 'Layout/Divider',
  component: Divider,
} satisfies Meta<typeof Divider>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => (
    <Stack gap={3}>
      <Text>Cash</Text>
      <Divider />
      <Text>Bonus</Text>
    </Stack>
  ),
};

export const Vertical: Story = {
  render: () => (
    <Inline gap={3}>
      <Text>Table 3</Text>
      <Divider orientation="vertical" />
      <Text tone="muted">100/200</Text>
    </Inline>
  ),
};

export const LongText: Story = {
  render: () => (
    <Stack gap={3}>
      <Text>Markers settle against the cash-out first, then against any deposit the member makes before the due date.</Text>
      <Divider />
      <Text>A marker past its due date blocks new buy-ins until it is settled at the cage.</Text>
    </Stack>
  ),
};

export const Hindi: Story = {
  globals: { locale: 'hi' },
  render: () => (
    <Stack gap={3}>
      <Text>नकद</Text>
      <Divider />
      <Text>बोनस</Text>
    </Stack>
  ),
};
