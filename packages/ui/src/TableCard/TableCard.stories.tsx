import type { Meta, StoryObj } from '@storybook/react-vite';
import { TableCard } from './TableCard.tsx';

const TABLE_3 = [
  { number: 1, initials: 'VR' }, { number: 2, initials: 'DM' }, { number: 3, initials: 'IC' }, { number: 4, initials: 'MI' },
  { number: 5, initials: 'TA' }, { number: 6, initials: 'SJ' }, { number: 7, initials: 'AK' }, { number: 8, initials: 'FQ' },
  { number: 9, initials: null },
];

const meta = {
  title: 'Floor/TableCard',
  component: TableCard,
  args: {
    name: 'Table 3', stakes: '100/200', seats: TABLE_3, ringLabel: 'Table 3, 8 of 9 seats taken', occupancy: '8 of 9',
    rake: 9_630_000n, dealer: 'Pema Lepcha', pace: '30 hands/hr', onSelect: () => undefined,
  },
} satisfies Meta<typeof TableCard>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Table 3 as in the prototype. */
export const Default: Story = {};

/** The table open beside the plan. */
export const Selected: Story = { args: { isSelected: true } };

/** Table 4, closed and empty. */
export const Closed: Story = {
  args: {
    name: 'Table 4', seats: TABLE_3.map((seat) => ({ ...seat, initials: null })), ringLabel: 'Table 4, closed', isClosed: true,
    occupancy: 'Closed', rake: 0n, dealer: 'No dealer', pace: '-',
  },
};

/** For staff who do not read the ledger: no rake. */
export const WithoutRake: Story = { args: { rake: null } };

/** A long dealer's name and a big night. */
export const LongText: Story = {
  args: { name: 'Private Room', ringLabel: 'Private Room, 8 of 9 seats taken', dealer: 'Karma Tsering Bhutia Wangchuk', rake: 164_200_000n, pace: '124 hands/hr' },
};
