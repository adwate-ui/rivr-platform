import type { Meta, StoryObj } from '@storybook/react-vite';
import { Heatmap } from './Heatmap.tsx';

// A heatmap has no loading or error state of its own: the review says when the answers cannot load.
const meta = {
  title: 'Learn/Heatmap',
  component: Heatmap,
  decorators: [(Story) => <div className="w-96 bg-surface p-4"><Story /></div>],
  args: {
    label: 'Accuracy by street and position',
    corner: 'Street',
    columns: ['UTG', 'CO', 'BTN', 'SB', 'BB'],
    rows: [
      { name: 'Preflop', cells: [{ value: '82%', detail: '23/28', band: 'strong' }, { value: '64%', detail: '16/25', band: 'fair' },
        { value: '44%', detail: '18/41', band: 'weak' }, { value: '50%', detail: '3/6', band: 'thin' }, null] },
      { name: 'Flop', cells: [null, { value: '71%', detail: '15/21', band: 'fair' }, { value: '58%', detail: '11/19', band: 'weak' },
        null, { value: '90%', detail: '18/20', band: 'strong' }] },
    ],
    emptyText: 'Answer some spots to see where you are strong and weak.',
  },
} satisfies Meta<typeof Heatmap>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Empty: Story = { args: { rows: [] } };

/** Long names stay readable; the grid scrolls sideways on a phone rather than squeezing. */
export const LongText: Story = {
  args: {
    corner: 'Board texture', columns: ['Under the gun', 'Hijack', 'Cut-off', 'Button'],
    rows: [{ name: 'Monotone and connected', cells: [{ value: '100%', detail: '12/12', band: 'strong' }, null, null, { value: '33%', detail: '4/12', band: 'weak' }] }],
  },
};
