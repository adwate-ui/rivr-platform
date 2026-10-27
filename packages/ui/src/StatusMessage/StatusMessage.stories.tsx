import type { Meta, StoryObj } from '@storybook/react-vite';
import { StatusMessage } from './StatusMessage.tsx';

const meta = {
  title: 'Feedback/StatusMessage',
  component: StatusMessage,
  args: { children: 'Sent to the bar: KOT 12, to Table 3, seat 5.' },
} satisfies Meta<typeof StatusMessage>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const LongText: Story = {
  args: {
    children:
      'Sent to the bar: KOT 128, to the Private Room, seat 10. It comes to your seat when it is ready, and you pay Glaza then.',
  },
};
