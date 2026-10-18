import type { Meta, StoryObj } from '@storybook/react-vite';
import { ErrorMessage } from './ErrorMessage.tsx';

const meta = {
  title: 'Feedback/ErrorMessage',
  component: ErrorMessage,
  args: { children: 'This UTR is already on another booking.' },
} satisfies Meta<typeof ErrorMessage>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const LongText: Story = {
  args: {
    children:
      'Could not save this. Check the connection and try again. If it keeps failing, the cage can record the payment by hand and confirm it later.',
  },
};
