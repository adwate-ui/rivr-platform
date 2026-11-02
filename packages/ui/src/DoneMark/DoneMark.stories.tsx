import type { Meta, StoryObj } from '@storybook/react-vite';
import { DoneMark } from './DoneMark.tsx';

// A mark with no state of its own.
const meta = {
  title: 'Feedback/DoneMark',
  component: DoneMark,
} satisfies Meta<typeof DoneMark>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
