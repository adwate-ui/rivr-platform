import type { Meta, StoryObj } from '@storybook/react-vite';
import { CameraButton } from './CameraButton.tsx';

// A camera button has no empty or error state of its own: the screen around it says what went wrong.
const meta = {
  title: 'Controls/CameraButton',
  component: CameraButton,
  args: { children: 'Take a selfie', variant: 'primary', onPhoto: () => undefined },
} satisfies Meta<typeof CameraButton>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Loading: Story = { args: { isLoading: true } };

export const LongText: Story = { args: { children: 'Take a photo of the receipt with the amount showing', variant: 'secondary' } };

export const FullWidth: Story = { args: { fullWidth: true } };
