import type { Meta, StoryObj } from '@storybook/react-vite';
import { SelfieCamera } from './SelfieCamera.tsx';

// Storybook's browser has no camera, so the story shows the camera missing, with the QR code to carry on with a phone. The
// live camera and its review are covered by the tests and the e2e flow's fake camera.
const meta = {
  title: 'Controls/SelfieCamera',
  component: SelfieCamera,
  tags: ['viewport-phone'],
  parameters: { layout: 'fullscreen' },
  args: { onPhoto: () => undefined, onBack: () => undefined, phoneUrl: 'https://app.rivr.test/kyc' },
} satisfies Meta<typeof SelfieCamera>;

export default meta;
type Story = StoryObj<typeof meta>;

export const NoCamera: Story = {};
