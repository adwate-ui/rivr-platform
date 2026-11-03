import type { Meta, StoryObj } from '@storybook/react-vite';
import { HeaderPulse } from './HeaderPulse.tsx';

// The pulse is counts the app already holds: it has no loading or error state of its own.
const meta = {
  title: 'Navigation/HeaderPulse',
  component: HeaderPulse,
  args: {
    label: 'Tonight',
    items: [
      { id: 'seated', count: 23, label: 'seated', href: '#floor' },
      { id: 'waiting', count: 9, label: 'waiting', href: '#waitlist' },
      { id: 'requests', count: 6, label: 'requests', href: '#requests', needsYou: true },
    ],
  },
} satisfies Meta<typeof HeaderPulse>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Requests waiting: a gold dot before their count. */
export const Default: Story = {};

/** Nothing asks for the floor: no dot. */
export const Empty: Story = {
  args: {
    items: [
      { id: 'seated', count: 0, label: 'seated', href: '#floor' },
      { id: 'waiting', count: 0, label: 'waiting', href: '#waitlist' },
      { id: 'requests', count: 0, label: 'requests', href: '#requests', needsYou: true },
    ],
  },
};

export const LongText: Story = {
  args: {
    items: [
      { id: 'seated', count: 1_284, label: 'seated across both rooms', href: '#floor' },
      { id: 'requests', count: 128, label: 'requests waiting for the floor', href: '#requests', needsYou: true },
    ],
  },
};
