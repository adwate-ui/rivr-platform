import type { Meta, StoryObj } from '@storybook/react-vite';
import { ResendButton } from './ResendButton.tsx';

// A button with no data of its own: its loading state is the code being asked for; there is nothing empty or failed to show.
const meta = {
  title: 'Controls/ResendButton',
  component: ResendButton,
  args: { label: 'Resend code', waitingLabel: (time: string) => `Resend code in ${time}`, onResend: async () => true, isLoading: false },
} satisfies Meta<typeof ResendButton>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Counting down the minute after a code went: "Resend code in 1:00". */
export const Default: Story = {};

export const Loading: Story = { args: { isLoading: true } };
