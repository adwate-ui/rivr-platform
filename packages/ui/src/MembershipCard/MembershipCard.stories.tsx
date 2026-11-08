import type { Meta, StoryObj } from '@storybook/react-vite';
import { tokens } from '@rivr/tokens';
import { KycPhoto } from '../KycPhoto/KycPhoto.tsx';
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

// A plain portrait drawn in place, in the palette, so the screenshot never depends on a network image.
const { greenBlack, cream } = tokens.color;
const PORTRAIT =
  'data:image/svg+xml,' +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 30 40"><rect width="30" height="40" fill="${greenBlack}"/>` +
      `<circle cx="15" cy="15" r="7" fill="${cream}"/><rect x="5" y="25" width="20" height="15" rx="6" fill="${cream}"/></svg>`,
  );
const QR = <QrCode value="6f1c2a54-9d3e-4b7a-8c11-2f0e5d6a7b8c.58931234.0a1b2c3d4e5f6a7b8c9d0e1f" label="Your door code" />;

/** With the member's verified selfie, as the player app shows it (decision 0300). */
export const WithPhoto: Story = { args: { qr: QR, photo: <KycPhoto isFilling alt="Your photo" src={PORTRAIT} /> } };

/** A long name with a photo: the photo gives way, and the card keeps its shape. */
export const LongTextWithPhoto: Story = {
  args: { name: 'Venkataraghavan Subramaniam Iyer', tier: "Founders' Circle", memberNumber: '1048576', qr: QR,
    photo: <KycPhoto isFilling alt="Your photo" src={PORTRAIT} /> },
};

export const LongText: Story = {
  args: { name: 'Venkataraghavan Subramaniam Iyer', tier: "Founders' Circle", memberNumber: '1048576' },
};

/** The player app's card tab (decision 0320): gold-edged, no QR on the card. */
export const Redesign: Story = { args: { look: 'redesign', qr: undefined } };

/** The card tab with the member's verified selfie filling its frame, at a phone's width: one border, no stripe (F-201). */
export const RedesignWithPhoto: Story = {
  tags: ['viewport-phone'],
  args: { look: 'redesign', qr: undefined, name: 'Kabir Sethi', tier: 'Member', memberNumber: '14', photo: <KycPhoto isFilling alt="Your photo" src={PORTRAIT} /> },
};

/** The card tab when the selfie could not load: the frame stays whole and shows the member's initial (F-205). */
export const RedesignPhotoNotLoaded: Story = {
  tags: ['viewport-phone'],
  args: { ...RedesignWithPhoto.args, photo: <KycPhoto isFilling alt="Your photo" src={null} status="error" initial="K" /> },
};
