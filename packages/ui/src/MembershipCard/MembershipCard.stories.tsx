import type { Meta, StoryObj } from '@storybook/react-vite';
import { MembershipCard } from './MembershipCard.tsx';

// The card draws what it is given: the player app shows its loading and error states around it (#71).
const meta = {
  title: 'Paper/MembershipCard',
  component: MembershipCard,
  args: { name: 'Arjun Mehta', tier: 'Black card', memberNumber: '1024' },
} satisfies Meta<typeof MembershipCard>;

export default meta;
type Story = StoryObj<typeof meta>;

/** The QR square empty, as before the app has a code to draw in it. */
export const Default: Story = {};

export const LongText: Story = {
  args: { name: 'Venkataraghavan Subramaniam Iyer', tier: "Founders' Circle", memberNumber: '1048576' },
};
