import type { Meta, StoryObj } from '@storybook/react-vite';
import { QrCode } from '../QrCode/QrCode.tsx';
import { MembershipCard } from './MembershipCard.tsx';

// The card draws what it is given: the player app shows its loading and error states around it (#71).
const meta = {
  title: 'Paper/MembershipCard',
  component: MembershipCard,
  args: { name: 'Arjun Mehta', tier: 'Black card', memberNumber: '1024' },
} satisfies Meta<typeof MembershipCard>;

export default meta;
type Story = StoryObj<typeof meta>;

/** The QR square empty, as an image of the card is drawn (decision 0160). */
export const Default: Story = {};

/** As the player app shows it at the door, with the QR it scans (#71). */
export const WithQr: Story = {
  args: { qr: <QrCode value="6f1c2a54-9d3e-4b7a-8c11-2f0e5d6a7b8c.58931234.0a1b2c3d4e5f6a7b8c9d0e1f" label="Your door code" /> },
};

export const LongText: Story = {
  args: { name: 'Venkataraghavan Subramaniam Iyer', tier: "Founders' Circle", memberNumber: '1048576' },
};
