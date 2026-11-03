import type { Meta, StoryObj } from '@storybook/react-vite';
import { BulkBar } from './BulkBar.tsx';

const HOLD = { id: 'hold', label: 'Hold', onClick: () => undefined };
const REMOVE = { id: 'remove', label: 'Remove', onClick: () => undefined, isMain: true };
const ACTIONS = [HOLD, REMOVE];

const meta = {
  title: 'Controls/BulkBar',
  component: BulkBar,
  tags: ['viewport-console'],
  args: { count: 3, actions: ACTIONS, onClear: () => undefined },
} satisfies Meta<typeof BulkBar>;

export default meta;
type Story = StoryObj<typeof meta>;

/** The waitlist with three entries ticked: Hold as words, Remove filled in ink, and Clear. */
export const Default: Story = {};

/** The main action in flight: its turning circle, and presses ignored. */
export const Loading: Story = {
  args: { actions: [HOLD, { ...REMOVE, isLoading: true }] },
};

/** None ticked: nothing shows, while the count stays for screen readers. */
export const NoneChosen: Story = { args: { count: 0 } };

/** A step that removes members, filled in the alert red, and a danger step as red words. */
export const Danger: Story = {
  args: {
    count: 12,
    actions: [
      { id: 'note', label: 'Add a note', onClick: () => undefined },
      { id: 'block', label: 'Block', onClick: () => undefined, tone: 'danger' },
      { id: 'remove', label: 'Remove', onClick: () => undefined, isMain: true, tone: 'danger' },
    ],
  },
};

export const LongText: Story = {
  args: {
    count: 128,
    actions: [
      { id: 'tier', label: 'Move to the Founders\' Circle tier', onClick: () => undefined },
      { id: 'message', label: 'Send a message on WhatsApp', onClick: () => undefined, isMain: true },
    ],
  },
};

/** Below 1180 px each action is a 44 px touch target, and the bar wraps on a phone. */
export const OnAPhone: Story = { tags: ['!viewport-console', 'viewport-phone'] };
