import type { Meta, StoryObj } from '@storybook/react-vite';
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
