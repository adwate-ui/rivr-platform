import type { Meta, StoryObj } from '@storybook/react-vite';
import { BalanceTile } from './BalanceTile.tsx';

// A tile shows one balance; the Bonus screen around it carries the loading, empty and error states.
const meta = {
  title: 'Data/BalanceTile',
  component: BalanceTile,
  args: { icon: 'chip', figure: '1,500', label: 'Bonus chips', line: 'Use with your buy-in. Never expire.', tone: 'money' },
} satisfies Meta<typeof BalanceTile>;

export default meta;
type Story = StoryObj<typeof meta>;

export const BonusChips: Story = { args: { onOpen: () => undefined, 'aria-expanded': false } };

/** The member's own balance at the top of Bonus (redesign RD-20). */
export const Hero: Story = {
  tags: ['viewport-phone'],
  args: { look: 'hero', icon: undefined, tone: 'default', figure: '14,000', label: 'Balance', line: 'Use with your buy-in. Never expires.' },
};

export const HeroLongText: Story = {
  tags: ['viewport-phone'],
  args: { look: 'hero', icon: undefined, tone: 'default', figure: '1,00,00,000', label: 'Balance', line: 'Use with your buy-in at any table in the club. Expires after 3,650 days.' },
};

export const LongText: Story = { args: { figure: '12,34,56,789', line: 'Use with your buy-in at any table in the club, on any night. Never expire.' } };
