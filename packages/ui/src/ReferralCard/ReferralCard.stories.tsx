import type { Meta, StoryObj } from '@storybook/react-vite';
import { ReferralCard } from './ReferralCard.tsx';

const text = {
  brand: 'RIVR',
  heading: 'Play with me at RIVR',
  codeLabel: 'My code',
  code: 'RIVR1042',
  footer: 'Sign up from my link. On your first buy-in, we both get a bonus.',
};

const meta = {
  title: 'Media/ReferralCard',
  component: ReferralCard,
  args: { text, alt: 'Referral card with the code RIVR1042' },
} satisfies Meta<typeof ReferralCard>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const LongText: Story = {
  args: { text: { ...text, code: 'RIVR1234567', heading: 'Come and play with me at RIVR Poker Club' } },
};
