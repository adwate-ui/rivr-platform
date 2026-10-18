import type { Meta, StoryObj } from '@storybook/react-vite';
import { PLAYER_TABS as items } from '../storybook/fixtures.ts';
import { BottomNav, type BottomNavItem } from './BottomNav.tsx';

const withLearn = (access: BottomNavItem['access']) => items.map((item) => (item.tab === 'learn' ? { ...item, access } : item));

const meta = {
  title: 'Navigation/BottomNav',
  component: BottomNav,
  args: { items, current: 'home' },
  parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof BottomNav>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const LockedTab: Story = { args: { items: withLearn({ state: 'locked', tiers: ['Academy graduate', 'Black card'] }) } };

export const HiddenTab: Story = { args: { items: withLearn({ state: 'hidden' }), current: 'balance' } };

export const Hindi: Story = { globals: { locale: 'hi' }, args: { current: 'rewards' } };
