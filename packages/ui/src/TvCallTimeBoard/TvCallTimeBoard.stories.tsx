import type { Meta, StoryObj } from '@storybook/react-vite';
import { DisplayShell } from '../DisplayShell/DisplayShell.tsx';
import { TvCallTimeBoard } from './TvCallTimeBoard.tsx';

const meta = {
  title: 'TV/TvCallTimeBoard',
  component: TvCallTimeBoard,
  tags: ['viewport-tv'],
  parameters: { layout: 'fullscreen' },
  decorators: [(Story) => <DisplayShell><Story /></DisplayShell>],
  args: {
    title: 'Call time',
    openingsTitle: 'Seats opening',
    noOpeningsText: 'No seats opening yet.',
    emptyText: 'No one on call time.',
    moreText: (hidden: number) => `+${hidden} more`,
    openings: [
      { id: 'o1', where: 'Table 3 · Seat 5', name: 'Kabir S.', time: 'Now', isNow: true },
      { id: 'o2', where: 'Private Room · Seat 2', name: 'Naina K.', time: 'In 25 min', isNow: false },
    ],
    tables: [
      {
        id: 't2', name: 'Table 2', detail: 'NLH 100/200',
        rows: [
          { id: 'r1', seat: '1', name: 'Rohan B.', time: '12 min' },
          { id: 'r2', seat: '4', name: 'Arjun M.', time: '48 min' },
        ],
      },
      { id: 't3', name: 'Table 3', detail: 'NLH 100/200', rows: [{ id: 'r3', seat: '2', name: 'Vihaan K.', time: '1 h' }] },
      { id: 'pr', name: 'Private Room', detail: 'Private Room', rows: [{ id: 'r4', seat: '1', name: 'Ishaan V.', time: '1 h 52 min' }] },
    ],
  },
} satisfies Meta<typeof TvCallTimeBoard>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

/** Nobody leaving and nobody on call time. */
export const Empty: Story = { args: { openings: [], tables: [] } };

/** More than fit: four openings and four players a table, each saying how many more; the tables a page at a time. */
export const Full: Story = {
  args: {
    page: 'Tables 1 to 4 of 5',
    openings: ['Kabir S.', 'Naina K.', 'Rohan B.', 'Arjun M.', 'Dev M.'].map((name, index) => ({
      id: `o${index}`, where: `Table ${index + 2} · Seat ${index + 1}`, name, time: `In ${(index + 1) * 10} min`, isNow: false,
    })),
    tables: ['Table 2', 'Table 3', 'Table 5', 'Private Room', 'Table 6'].map((table) => ({
      id: table, name: table, detail: 'NLH 100/200',
      rows: ['Rohan B.', 'Arjun M.', 'Ishaan V.', 'Vihaan K.', 'Dev M.'].map((name, index) => ({
        id: `${table}-${index}`, seat: String(index + 1), name, time: `${(index + 1) * 11} min`,
      })),
    })),
  },
};

export const LongText: Story = {
  args: {
    openings: [{ id: 'o1', where: 'Private Room · Seat 9', name: 'Venkataraghavan R.', time: 'In 1 h 59 min', isNow: false }],
    tables: [{ id: 'pr', name: 'Private Room', detail: 'PLO 1,000/2,000', rows: [{ id: 'r1', seat: '9', name: 'Venkataraghavan R.', time: '1 h 59 min' }] }],
  },
};
