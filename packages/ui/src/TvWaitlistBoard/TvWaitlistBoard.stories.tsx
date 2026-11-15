import type { Meta, StoryObj } from '@storybook/react-vite';
import { onTv } from '../test/tvStory.tsx';
import { TvWaitlistBoard, type TvWaitlistStake } from './TvWaitlistBoard.tsx';

const NAMES = ['Kabir S.', 'Naina K.', 'Rohan B.', 'Arjun M.', 'Ishaan V.', 'Vihaan K.', 'Dev M.', 'Zoya M.'];

/** A table's column with the first `count` of the names waiting. */
const column = (table: string, detail: string, count: number): TvWaitlistStake => ({
  id: table, stake: table, detail, places: NAMES.slice(0, count).map((name, index) => ({ id: `${table}-${index}`, place: String(index + 1), name })),
});

const meta = {
  title: 'TV/TvWaitlistBoard',
  component: TvWaitlistBoard,
  tags: ['viewport-tv'],
  parameters: { layout: 'fullscreen' },
  decorators: [onTv],
  args: {
    title: 'Waitlist',
    emptyText: 'No one waiting.',
    moreText: (hidden: number) => `+${hidden} more`,
    stakes: [
      { id: 't1', stake: 'Table 1', detail: 'NLH 50/100', places: [{ id: '1', place: '1', name: 'Vishal D.' }, { id: '2', place: '2', name: 'Mansi K.' }] },
      {
        id: 't2', stake: 'Table 2', detail: 'NLH 100/200',
        places: [{ id: '1', place: '1', name: 'Kabir S.' }, { id: '2', place: '2', name: 'Naina K.' }, { id: '3', place: '3', name: 'Rohan B.' }],
      },
      { id: 'pr', stake: 'Private Room', detail: 'NLH 100/200/500', places: [{ id: '1', place: '1', name: 'Samar D.' }] },
    ],
  },
} satisfies Meta<typeof TvWaitlistBoard>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

/** Nobody waits for any table. */
export const Empty: Story = { args: { stakes: [] } };

/** Four tables, more waiting for each than a column holds: six places, and how many more. */
export const Full: Story = {
  args: { stakes: ['Table 1', 'Table 2', 'Table 3', 'Private Room'].map((table) => column(table, 'NLH 100/200', 8)) },
};

/** More than four tables: a second row, each column with the places its half of the stage holds. */
export const TwoRows: Story = {
  args: { stakes: ['Table 1', 'Table 2', 'Table 3', 'Table 4', 'Table 5', 'Private Room'].map((table, index) => column(table, 'NLH 100/200', index + 1)) },
};

/** A player called to a seat, and one away: the status under the name, in gold. */
export const Statuses: Story = {
  args: {
    stakes: ['Table 1', 'Table 2'].map((table) => ({
      ...column(table, 'NLH 100/200', 7),
      places: NAMES.slice(0, 7).map((name, index) => ({
        id: String(index), place: String(index + 1), name, status: index === 0 ? 'Called to Table 2' : index === 2 ? 'Away' : undefined,
      })),
    })),
  },
};

/** More than eight tables take turns: the page under the columns, which hold less for it. */
export const Paged: Story = {
  args: {
    footer: 'Page 1 of 2',
    stakes: ['Table 1', 'Table 2', 'Table 3', 'Table 4', 'Table 5', 'Table 6', 'Table 7', 'Private Room'].map((table) => column(table, 'NLH 100/200', 3)),
  },
};

/** A long name steps down a size before it is cut; a closed table's line wraps; a member who hid their name is their place alone. */
export const LongText: Story = {
  args: {
    stakes: [
      {
        id: 'a', stake: 'Private Room', detail: 'PLO 1,000/2,000 · Closed',
        places: [{ id: '1', place: '1', name: 'Venkataraghavan R.', status: 'Called to Private Room' }, { id: '2', place: '2', name: '' }, { id: '3', place: '3', name: 'Rohan B.' }],
      },
      column('Table 2', 'NLH 100/200', 2),
    ],
  },
};
