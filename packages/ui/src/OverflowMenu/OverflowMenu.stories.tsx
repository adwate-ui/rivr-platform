import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, userEvent, within } from 'storybook/test';
import { OverflowMenu } from './OverflowMenu.tsx';

const ITEMS = [
  { id: 'hold', label: 'Hold place', onSelect: () => undefined },
  { id: 'move', label: 'Move to Table 2', onSelect: () => undefined, isDisabled: true },
  { id: 'remove', label: 'Remove from list', onSelect: () => undefined, tone: 'danger' as const },
];

/** Opens the menu, as a press on the ⋯ button does, so the story shows it. */
async function open({ canvasElement }: { canvasElement: HTMLElement }) {
  await userEvent.click(within(canvasElement).getByRole('button', { name: /^More for/ }));
  await expect(within(canvasElement).getByRole('menu')).toBeInTheDocument();
}

// A menu of actions has no loading, empty or error state of its own: an action's outcome is said by the screen.
const meta = {
  title: 'Controls/OverflowMenu',
  component: OverflowMenu,
  tags: ['viewport-console'],
  args: { label: 'More for Ritika Bhalla', items: ITEMS },
  // In the middle of the canvas, so a menu lined up with either edge of its button shows whole.
  decorators: [(Story) => <div className="flex justify-center"><Story /></div>],
} satisfies Meta<typeof OverflowMenu>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Closed: the ⋯ button, 32 px at a desk. */
export const Default: Story = {};

/** Open below its button, lined up with its end; a disabled item dimmed, a danger one in red. */
export const Open: Story = { play: open };

/** Lined up with the button's start, for a button at a row's start. */
export const AlignedToTheStart: Story = { args: { align: 'start' }, play: open };

export const LongText: Story = {
  args: {
    label: 'More for Ritika Venkataraman-Chakraborty',
    items: [
      { id: 'hold', label: 'Hold her place until she is back from the cage', onSelect: () => undefined },
      { id: 'remove', label: 'Remove from the waitlist for tonight', onSelect: () => undefined, tone: 'danger' },
    ],
  },
  play: open,
};

/** Below 1180 px the button is a 44 px touch target. */
export const OnAPortraitTablet: Story = { tags: ['!viewport-console', 'viewport-portrait'], play: open };
