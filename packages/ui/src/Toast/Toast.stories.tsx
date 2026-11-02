import type { Meta, StoryObj } from '@storybook/react-vite';
import { Toast } from './Toast.tsx';

// A toast confirms what the member just did; it has no loading, empty or error state of its own.
const meta = {
  title: 'Feedback/Toast',
  component: Toast,
  args: { text: 'Order sent', onClose: () => undefined },
} satisfies Meta<typeof Toast>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const WithUndo: Story = { args: { text: 'Joined waitlist', onUndo: () => undefined } };

export const LongText: Story = { args: { text: 'Seated at Private Room, seat 9, No-Limit Hold\'em 100/200', onUndo: () => undefined } };
