import type { Meta, StoryObj } from '@storybook/react-vite';
import { Box } from '../Box/Box.tsx';
import { RequestItem } from './RequestItem.tsx';

// A request is one entry in the floor's queue; the queue's loading and empty states are the panel's.
const meta = {
  title: 'Floor/RequestItem',
  component: RequestItem,
  args: {
    kind: 'Join request', age: '4 min', title: 'Ritika Bhalla', detail: 'Table 1 waitlist', onTitle: () => undefined,
    primary: { label: 'Approve', onClick: () => undefined }, secondary: { label: 'Decline', onClick: () => undefined },
  },
  decorators: [(Story) => <Box surface="raised" paddingX={5} paddingY={2}><Story /></Box>],
} satisfies Meta<typeof RequestItem>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

/** Past its target: the age in the danger colour. One action only. */
export const Late: Story = {
  args: { kind: 'Top-up', title: 'Vidya Chadha', detail: 'Table 1, seat 2', isLate: true, primary: { label: 'Start', onClick: () => undefined }, secondary: undefined },
};

/** Just arrived: a gold tint that fades. */
export const New: Story = { args: { isNew: true } };

/** The action in flight. */
export const Loading: Story = { args: { primary: { label: 'Approve', onClick: () => undefined, isLoading: true } } };

export const LongText: Story = {
  args: {
    kind: 'Left before call time', age: undefined, title: 'Venkataraghavan Subramaniam-Krishnamurthy',
    detail: 'Private Room upstairs by the bar, seat 9 · 1 h 25 min owed', primary: { label: 'Record', onClick: () => undefined }, secondary: undefined,
  },
};
