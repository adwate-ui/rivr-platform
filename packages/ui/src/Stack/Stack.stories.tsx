import type { Meta, StoryObj } from '@storybook/react-vite';
import { Text } from '../Text/Text.tsx';
import { Stack } from './Stack.tsx';

const meta = {
  title: 'Layout/Stack',
  component: Stack,
  args: {
    gap: 4,
    children: [
      <Text key="1">Table 1 · 50/100</Text>,
      <Text key="2">Table 2 · 100/200</Text>,
      <Text key="3">Private Room · 1,000/2,000</Text>,
    ],
  },
} satisfies Meta<typeof Stack>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Divided: Story = { args: { gap: 3, divided: true } };

export const Empty: Story = { args: { children: <Text tone="muted">No tables open.</Text> } };

export const LongText: Story = {
  args: {
    children: [
      <Text key="1">
        Table 2 runs 100/200 No-limit Hold’em with a ₹10,000 minimum buy-in and call time after two hours of play.
      </Text>,
      <Text key="2">Table 5 opens when the waitlist for 100/200 reaches eight members.</Text>,
    ],
  },
};
