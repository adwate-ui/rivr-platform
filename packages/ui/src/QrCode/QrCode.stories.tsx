import type { Meta, StoryObj } from '@storybook/react-vite';
import { QrCode } from './QrCode.tsx';

// A QR code draws the value it is given: whoever shows it holds the loading and error states. It fills
// its container, so each story shows it where it lives, in the cream square the camera's hand-off to a phone draws.
const meta = {
  title: 'Data/QrCode',
  component: QrCode,
  args: { value: '6f1c2a54-9d3e-4b7a-8c11-2f0e5d6a7b8c.58931234.0a1b2c3d4e5f6a7b8c9d0e1f', label: 'Open this on your phone' },
  render: (args) => <div className="size-photo rounded-md bg-cream p-3"><QrCode {...args} /></div>,
} satisfies Meta<typeof QrCode>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

/** A longer value takes a denser code, still square in the same space. */
export const LongText: Story = {
  args: { value: `6f1c2a54-9d3e-4b7a-8c11-2f0e5d6a7b8c.58931234.${'0a1b2c3d4e5f6a7b8c9d0e1f'.repeat(4)}` },
};
