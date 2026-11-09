import { tokens } from '@rivr/tokens';
import type { Decorator, Meta, StoryObj } from '@storybook/react-vite';
import { expect, userEvent, waitFor, within } from 'storybook/test';
import { Text } from '../Text/Text.tsx';
import { AADHAAR_FRONT_COVERS, coveredPhoto } from './coverBars.ts';
import { DocumentCamera } from './DocumentCamera.tsx';

/** A bare table as the camera's stream, so the story looks the same on every run: no card, so it never takes itself. */
function stillStream(): MediaStream {
  const canvas = document.createElement('canvas');
  canvas.width = 1920;
  canvas.height = 1440;
  const context = canvas.getContext('2d');
  if (context) {
    context.fillStyle = tokens.color.green;
    context.fillRect(0, 0, canvas.width, canvas.height);
  }
  return canvas.captureStream(1);
}

/** Stands in for the browser's camera: a still picture, one that never comes, or the refusal named. */
function camera(answer: 'still' | 'never' | 'NotAllowedError' | 'NotFoundError'): Decorator {
  return (Story) => {
    // The visual tests serve Storybook over plain http, where a browser offers no camera: this page counts as secure.
    Object.defineProperty(window, 'isSecureContext', { configurable: true, value: true });
    // A phone or tablet, which is taken at its word about its camera: a canvas does not say which way it faces.
    Object.defineProperty(navigator, 'maxTouchPoints', { configurable: true, value: 1 });
    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: {
        getUserMedia: () => {
          if (answer === 'still') return Promise.resolve(stillStream());
          return answer === 'never' ? new Promise<MediaStream>(() => undefined) : Promise.reject(new DOMException('', answer));
        },
      },
    });
    return <Story />;
  };
}

const meta = {
  title: 'Controls/DocumentCamera',
  component: DocumentCamera,
  args: { label: 'PAN card', onPhoto: () => undefined, phoneUrl: 'https://rivr-console-staging.pages.dev/kyc-review' },
  parameters: { layout: 'padded' },
} satisfies Meta<typeof DocumentCamera>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Takes the photo once the shutter is live. */
async function takePhoto(canvasElement: HTMLElement) {
  const shutter = await within(canvasElement).findByRole('button', { name: 'Take photo' });
  await waitFor(async () => expect(shutter).toBeEnabled());
  await userEvent.click(shutter);
}

export const Default: Story = { decorators: [camera('still')] };

export const Starting: Story = { decorators: [camera('never')] };

export const Blocked: Story = { decorators: [camera('NotAllowedError')] };

export const NoCamera: Story = { decorators: [camera('NotFoundError')] };

export const LongLabel: Story = { decorators: [camera('still')], args: { label: 'Aadhaar card, the front with the photo and the number, held flat under good light' } };

export const CheckingThePhoto: Story = {
  decorators: [camera('still')],
  play: async ({ canvasElement }) => {
    await takePhoto(canvasElement);
    await within(canvasElement).findByRole('button', { name: 'Zoom in' });
  },
};

export const PlacingTheBars: Story = {
  decorators: [camera('still')],
  args: { label: 'Aadhaar front', covers: AADHAAR_FRONT_COVERS, coverConfirm: 'The first eight digits and the QR code are hidden' },
  play: async ({ canvasElement }) => {
    await takePhoto(canvasElement);
    const canvas = within(canvasElement);
    await canvas.findByRole('button', { name: /^Bar 2/ });
    await expect(canvas.getByRole('button', { name: 'Use photo' })).toBeDisabled();
  },
};

/** The grey of a pixel of a JPEG, read back in a real browser. */
async function brightnessAt(photo: Blob, x: number, y: number): Promise<number> {
  const image = await createImageBitmap(photo);
  const canvas = document.createElement('canvas');
  canvas.width = image.width;
  canvas.height = image.height;
  const context = canvas.getContext('2d');
  if (context === null) throw new Error('No canvas');
  context.drawImage(image, 0, 0);
  const [red = 0, green = 0, blue = 0] = context.getImageData(x, y, 1, 1).data;
  return (red + green + blue) / 3;
}

/** Proof in a real browser that what is under a bar is gone from the saved file, not hidden by something over it. */
export const BarsArePaintedIntoTheFile: Story = {
  render: () => <Text>The saved file has no picture left under its bars.</Text>,
  play: async () => {
    const canvas = document.createElement('canvas');
    canvas.width = 800;
    canvas.height = 500;
    const context = canvas.getContext('2d');
    if (context === null) throw new Error('No canvas');
    context.fillStyle = tokens.color.cream;
    context.fillRect(0, 0, 800, 500);
    const white = await new Promise<Blob>((resolve) => { canvas.toBlob((jpeg) => { if (jpeg) resolve(jpeg); }, 'image/jpeg'); });
    const covered = await coveredPhoto(white, [{ x: 0.1, y: 0.2, width: 0.5, height: 0.4 }]);
    await expect(await brightnessAt(covered, 240, 200)).toBeLessThan(70);
    await expect(await brightnessAt(covered, 700, 450)).toBeGreaterThan(200);
  },
};
