import type { Meta, StoryObj } from '@storybook/react-vite';
import { Inline } from '../Inline/Inline.tsx';
import { Text } from '../Text/Text.tsx';
import { Time } from './Time.tsx';

// 02:40 IST on the opening night.
const OPENING_NIGHT = new Date('2026-11-14T21:10:00Z');

const meta = {
  title: 'Type/Time',
  component: Time,
  args: { at: OPENING_NIGHT },
} satisfies Meta<typeof Time>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const HoldExpires: Story = {
  render: () => (
    <Inline gap={2} align="baseline">
      <Text>Hold expires</Text>
      <Time at={OPENING_NIGHT} size="lead" />
    </Inline>
  ),
};

export const LongText: Story = {
  render: () => (
    <Inline gap={2} align="baseline" wrap>
      <Text>Call time for the 100/200 game on Table 2 completes at</Text>
      <Time at={OPENING_NIGHT} />
    </Inline>
  ),
};

export const Hindi: Story = {
  globals: { locale: 'hi' },
  render: () => (
    <Inline gap={2} align="baseline">
      <Text>होल्ड खत्म</Text>
      <Time at={OPENING_NIGHT} size="lead" />
    </Inline>
  ),
};
