import type { Meta, StoryObj } from '@storybook/react-vite';
import { onTv } from '../test/tvStory.tsx';
import { TvHoursBoard, type TvHoursRow } from './TvHoursBoard.tsx';

const rows = (list: string, places: readonly (readonly [string, string])[]): TvHoursRow[] =>
  places.map(([name, time], index) => ({ id: `${list}-${index}`, place: String(index + 1), name, time }));

const TONIGHT = rows('tonight', [
  ['Ishaan V.', '5 h 39 min'], ['Vihaan K.', '5 h 33 min'], ['Rhea S.', '5 h 12 min'], ['Kavya R.', '4 h 41 min'], ['Siddharth V.', '4 h 28 min'], ['Kunal M.', '3 h 50 min'],
]);
const WEEK = rows('week', [
  ['Vihaan K.', '31 h 10 min'], ['Ishaan V.', '28 h 45 min'], ['Zoya M.', '24 h 2 min'], ['Rhea S.', '22 h 30 min'], ['Kavya R.', '19 h 55 min'], ['Neel B.', '17 h 20 min'],
  ['Arjun M.', '15 h 30 min'],
]);

const meta = {
  title: 'TV/TvHoursBoard',
  component: TvHoursBoard,
  tags: ['viewport-tv'],
  parameters: { layout: 'fullscreen' },
  decorators: [onTv],
  args: {
    title: 'Most hours played',
    emptyText: 'No hours played yet.',
    moreText: (hidden: number) => `+${hidden} more`,
    lists: [{ id: 'tonight', caption: 'Tonight', rows: TONIGHT }, { id: 'week', caption: 'This week', rows: WEEK }],
  },
} satisfies Meta<typeof TvHoursBoard>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

/** Nobody has played tonight yet: its list says so, beside the week's. */
export const Empty: Story = { args: { lists: [{ id: 'tonight', caption: 'Tonight', rows: [] }, { id: 'week', caption: 'This week', rows: WEEK }] } };

/** The club's top twelve: each list shows the six the stage holds, and how many more. */
export const Full: Story = {
  args: {
    lists: [
      { id: 'tonight', caption: 'Tonight', rows: [...TONIGHT, ...TONIGHT].map((row, index) => ({ ...row, id: `t${index}`, place: String(index + 1) })) },
      { id: 'month', caption: 'This month', rows: [...WEEK, ...WEEK].slice(0, 12).map((row, index) => ({ ...row, id: `m${index}`, place: String(index + 1) })) },
    ],
  },
};

/** A long name keeps its whole width, its time under it; a member who hid their name shows by number. */
export const LongText: Story = {
  args: {
    lists: [
      { id: 'tonight', caption: 'Tonight', rows: rows('tonight', [['Venkataraghavan Subramanian R.', '5 h 39 min'], ['Member 1024', '5 h 33 min'], ['Rhea S.', '45 min']]) },
      { id: 'all', caption: 'All time', rows: rows('all', [['Chandrashekhar P.', '1,204 h 10 min'], ['Ishaan V.', '998 h']]) },
    ],
  },
};
