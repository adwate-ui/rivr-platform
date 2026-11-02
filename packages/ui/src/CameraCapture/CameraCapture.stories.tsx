import { tokens } from '@rivr/tokens';
import type { Decorator, Meta, StoryObj } from '@storybook/react-vite';
import { CameraCapture } from './CameraCapture.tsx';

/** A still picture as the camera's stream, so the story looks the same on every run: a head and shoulders in shadow. */
function stillStream(): MediaStream {
  const canvas = document.createElement('canvas');
  canvas.width = 960;
  canvas.height = 1280;
  const context = canvas.getContext('2d');
  if (context) {
    context.fillStyle = tokens.color.greenBlack;
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.fillStyle = tokens.color.green;
    context.beginPath();
    context.ellipse(480, 560, 230, 300, 0, 0, Math.PI * 2);
    context.ellipse(480, 1320, 420, 380, 0, 0, Math.PI * 2);
    context.fill();
  }
  return canvas.captureStream(1);
}

/** Stands in for the browser's camera: a still picture, or the refusal named. */
function camera(answer: 'still' | 'NotAllowedError' | 'NotFoundError' | 'NotReadableError'): Decorator {
  return (Story) => {
    // The visual tests serve Storybook over plain http, where a browser offers no camera: this page counts as secure.
    Object.defineProperty(window, 'isSecureContext', { configurable: true, value: true });
    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: { getUserMedia: () => (answer === 'still' ? Promise.resolve(stillStream()) : Promise.reject(new DOMException('', answer))) },
    });
    return <Story />;
  };
}

// The camera has no empty state; loading is "Starting the camera", and its errors are the stories below.
const meta = {
  title: 'Controls/CameraCapture',
  component: CameraCapture,
  args: { hasFaceGuide: true, onPhoto: () => undefined, phoneUrl: 'https://rivr-player-staging.pages.dev/kyc' },
  parameters: { layout: 'padded' },
} satisfies Meta<typeof CameraCapture>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Selfie: Story = { decorators: [camera('still')] };

export const AtTheDesk: Story = { args: { facing: 'environment', hasFaceGuide: false }, decorators: [camera('still')] };

export const Blocked: Story = { decorators: [camera('NotAllowedError')] };

export const NoCamera: Story = { decorators: [camera('NotFoundError')] };

export const NoCameraNoPhone: Story = { args: { phoneUrl: undefined }, decorators: [camera('NotFoundError')] };

export const Failed: Story = { decorators: [camera('NotReadableError')] };
