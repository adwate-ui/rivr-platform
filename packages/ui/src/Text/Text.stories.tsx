import type { Meta, StoryObj } from '@storybook/react-vite';
import { Stack } from '../Stack/Stack.tsx';
import { Text } from './Text.tsx';

const meta = {
  title: 'Type/Text',
  component: Text,
  args: { children: 'Your seat is ready. Table 3, seat 6.' },
} satisfies Meta<typeof Text>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Variants: Story = {
  render: () => (
    <Stack gap={3}>
      <Text variant="lead">Lead · Hold expires 02:40</Text>
      <Text>Body · Your seat is ready. Table 3, seat 6.</Text>
      <Text variant="label">Label · Payout account</Text>
      <Text variant="small">Small · Joined 22:15</Text>
      <Text variant="caption">Caption · RIVR Academy</Text>
      <Text variant="tvLabel">High hand tonight</Text>
    </Stack>
  ),
};

export const Tones: Story = {
  render: () => (
    <Stack gap={2}>
      <Text>Default · Balance</Text>
      <Text tone="muted">Muted · Expires Sunday</Text>
      <Text tone="money">Money · ₹4,000 bonus</Text>
    </Stack>
  ),
};

export const Empty: Story = { args: { children: 'No sessions yet.', tone: 'muted' } };

export const LongText: Story = {
  args: {
    children:
      'Withdrawals above ₹1,00,000 need a second approver at the cage. The amount leaves your cash balance when the cashier approves it, and the UTR appears here once the bank confirms the transfer.',
  },
};

export const Truncated: Story = {
  args: { truncate: true, children: 'Founders’ Circle member since the opening night of the club in Gurugram' },
  decorators: [
    (Story) => (
      <Stack gap={0} align="start">
        <Story />
      </Stack>
    ),
  ],
};
