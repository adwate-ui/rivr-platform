import type { Meta, StoryObj } from '@storybook/react-vite';
import { Box } from '../Box/Box.tsx';
import { WaitlistRow } from './WaitlistRow.tsx';

const noop = () => undefined;

// A place is a row in a table's waitlist card; the card's loading, empty and error states are the screen's.
const meta = {
  title: 'Floor/WaitlistRow',
  component: WaitlistRow,
  args: {
    position: 1,
    name: 'Ishaan Verma',
    meta: '5 min · added by the floor',
    tick: { label: 'Select Ishaan Verma', isTicked: false, onToggle: noop },
    action: { label: 'Seat', name: 'Seat Ishaan Verma', onClick: noop },
    menu: { label: 'More for Ishaan Verma', items: [{ id: 'hold', label: 'Hold place', onSelect: noop }, { id: 'remove', label: 'Remove from list', onSelect: noop, tone: 'danger' }] },
  },
  decorators: [(Story) => <Box surface="raised" paddingY={2}><Story /></Box>],
} satisfies Meta<typeof WaitlistRow>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Ticked: Story = { args: { tick: { label: 'Select Ishaan Verma', isTicked: true, onToggle: noop } } };

/** A place held while the member is away: the name muted, the meta says so. */
export const Held: Story = { args: { position: 2, name: 'Naina Kapoor', meta: '29 min · place held', isHeld: true } };

/** Seating: the button turns while the seat is taken. */
export const Loading: Story = { args: { action: { label: 'Seat', name: 'Seat Ishaan Verma', onClick: noop, isLoading: true } } };

export const Compact: Story = { args: { density: 'compact' } };

/** Call beside Seat, for a waiting member with a free seat (the owner, 8 Nov). */
export const WithCall: Story = { args: { secondary: { label: 'Call', name: 'Call Ishaan Verma', onClick: noop } } };

export const LongText: Story = {
  args: { position: 12, name: 'Venkataraghavan Subramaniam-Krishnamurthy', meta: '1 h 45 min · added by the floor · place held' },
};

export const OnAPhone: Story = { tags: ['viewport-phone'] };

/** Call and Seat under a long name, on a phone: the name keeps its line. */
export const WithCallOnAPhone: Story = {
  tags: ['viewport-phone'],
  args: { name: 'Venkataraghavan Subramaniam-Krishnamurthy', secondary: { label: 'Call', name: 'Call Venkataraghavan', onClick: noop } },
};
