import type { Meta, StoryObj } from '@storybook/react-vite';
import { Skeleton } from './Skeleton.tsx';

// The skeleton is the loading state itself.
const meta = {
  title: 'Feedback/Skeleton',
  component: Skeleton,
} satisfies Meta<typeof Skeleton>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const OneRow: Story = { args: { rows: 1 } };
