import type { Meta, StoryObj } from '@storybook/react-vite';
import { Text } from '../Text/Text.tsx';
import { Box } from './Box.tsx';

const meta = {
  title: 'Layout/Box',
  component: Box,
  args: {
    padding: 4,
    surface: 'raised',
    radius: 'lg',
    children: <Text>Table 3 · 100/200 · 2 seats open</Text>,
  },
} satisfies Meta<typeof Box>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Hairline: Story = { args: { surface: 'none', hairline: 'bottom', radius: 'none' } };

export const CreamTile: Story = { args: { surface: 'cream', children: <Text tone="onCream">Black card</Text> } };

export const LongText: Story = {
  args: {
    children: (
      <Text>
        The Private Room seats nine at 1,000/2,000 with a ₹2,00,000 minimum buy-in. Seats are held for fifteen minutes after a call, then
        offered to the next member on the waitlist.
      </Text>
    ),
  },
};

export const Hindi: Story = {
  globals: { locale: 'hi' },
  args: { children: <Text>टेबल 3 · 100/200 · 2 सीटें खाली</Text> },
};
