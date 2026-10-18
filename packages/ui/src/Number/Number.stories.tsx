import type { Meta, StoryObj } from '@storybook/react-vite';
import { Inline } from '../Inline/Inline.tsx';
import { Text } from '../Text/Text.tsx';
import { Number } from './Number.tsx';

const meta = {
  title: 'Type/Number',
  component: Number,
  args: { value: 18_420 },
} satisfies Meta<typeof Number>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Title: Story = { args: { size: 'title' } };

export const Empty: Story = { args: { value: 0, tone: 'muted' } };

export const LongText: Story = { args: { value: 123_456_789, size: 'display' } };

export const Hindi: Story = {
  globals: { locale: 'hi' },
  render: () => (
    <Inline gap={3} align="baseline">
      <Text>पॉइंट</Text>
      <Number value={18_420} size="lead" />
    </Inline>
  ),
};
