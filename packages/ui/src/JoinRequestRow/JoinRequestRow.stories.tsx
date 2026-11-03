import type { Meta, StoryObj } from '@storybook/react-vite';
import { Box } from '../Box/Box.tsx';
import { JoinRequestRow } from './JoinRequestRow.tsx';

const noop = () => undefined;

// A request sits above a table's list in its waitlist card; the card's loading, empty and error states are the screen's.
const meta = {
  title: 'Floor/JoinRequestRow',
  component: JoinRequestRow,
  args: {
    name: 'Ritika Bhalla',
    note: 'asks to join',
    approve: { label: 'Approve', name: 'Approve Ritika Bhalla', onClick: noop },
    decline: { label: 'Decline', name: 'Decline Ritika Bhalla', onClick: noop },
  },
  decorators: [(Story) => <Box surface="raised" paddingY={2}><Story /></Box>],
} satisfies Meta<typeof JoinRequestRow>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

/** Approving: the button turns while the place is added. */
export const Loading: Story = { args: { approve: { label: 'Approve', name: 'Approve Ritika Bhalla', onClick: noop, isLoading: true } } };

export const LongText: Story = { args: { name: 'Venkataraghavan Subramaniam-Krishnamurthy' } };

export const OnAPhone: Story = { tags: ['viewport-phone'] };
