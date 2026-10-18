import type { Meta, StoryObj } from '@storybook/react-vite';
import { Wordmark } from './Wordmark.tsx';

const meta = {
  title: 'Type/Wordmark',
  component: Wordmark,
} satisfies Meta<typeof Wordmark>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const WithTagline: Story = { args: { withTagline: true } };

export const Large: Story = { args: { size: 'lg', withTagline: true } };

export const Hindi: Story = { globals: { locale: 'hi' }, args: { size: 'lg', withTagline: true } };
