import type { Meta, StoryObj } from '@storybook/react-vite';
import { MembershipCard } from '../MembershipCard/MembershipCard.tsx';
import { QrCode } from './QrCode.tsx';

// A QR code draws the value it is given: whoever shows it holds the loading and error states. It fills
// its container, so each story shows it where it lives, in the membership card's cream square.
const meta = {
  title: 'Data/QrCode',
  component: QrCode,
  args: { value: '6f1c2a54-9d3e-4b7a-8c11-2f0e5d6a7b8c.58931234.0a1b2c3d4e5f6a7b8c9d0e1f', label: 'Your door code' },
  render: (args) => <MembershipCard name="Arjun Mehta" tier="Black card" memberNumber="1024" qr={<QrCode {...args} />} />,
} satisfies Meta<typeof QrCode>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

/** A longer value takes a denser code, still square in the same space. */
export const LongText: Story = {
  args: { value: `6f1c2a54-9d3e-4b7a-8c11-2f0e5d6a7b8c.58931234.${'0a1b2c3d4e5f6a7b8c9d0e1f'.repeat(4)}` },
};
