import type { Meta, StoryObj } from '@storybook/react-vite';
import { LockedNotice } from './LockedNotice.tsx';

const meta = {
  title: 'Features/LockedNotice',
  component: LockedNotice,
  args: { tiers: ['Black card'] },
} satisfies Meta<typeof LockedNotice>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const TwoTiers: Story = { args: { tiers: ['Founders’ Circle', 'Black card'] } };

export const LongText: Story = { args: { tiers: ['Academy graduate', 'Founders’ Circle', 'Black card', 'Private Room regulars'] } };

/** Taken from this member alone by an override: no tier is the way in. */
export const TakenAway: Story = { args: { tiers: [] } };
