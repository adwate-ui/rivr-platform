import type { Meta, StoryObj } from '@storybook/react-vite';
import { KillSwitchBanner } from './KillSwitchBanner.tsx';

const meta = {
  title: 'Feedback/KillSwitchBanner',
  component: KillSwitchBanner,
  args: { audience: 'member' },
} satisfies Meta<typeof KillSwitchBanner>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Member: Story = {};

export const Staff: Story = { args: { audience: 'staff' } };

export const Hindi: Story = { globals: { locale: 'hi' } };

export const StaffHindi: Story = { globals: { locale: 'hi' }, args: { audience: 'staff' } };
