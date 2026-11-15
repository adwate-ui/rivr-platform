import type { Meta, StoryObj } from '@storybook/react-vite';
import { BalanceTile } from './BalanceTile.tsx';

// A tile shows one balance; the Bonus screen around it carries the loading, empty and error states.
const meta = {
  title: 'Data/BalanceTile',
  component: BalanceTile,
  args: { icon: 'chip', figure: '1,500', label: 'Bonus', line: 'Use with your buy-in. Never expires.', tone: 'money' },
} satisfies Meta<typeof BalanceTile>;

export default meta;
type Story = StoryObj<typeof meta>;

export const BonusChips: Story = { args: { onOpen: () => undefined, 'aria-expanded': false } };

export const LongText: Story = { args: { figure: '12,34,56,789', line: 'Use with your buy-in at any table in the club, on any night. Never expires.' } };
