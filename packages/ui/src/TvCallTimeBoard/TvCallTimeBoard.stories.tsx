import type { Meta, StoryObj } from '@storybook/react-vite';
import { onTv } from '../test/tvStory.tsx';
import { TvCallTimeBoard } from './TvCallTimeBoard.tsx';

const NAMES = ['Yash G.', 'Devansh M.', 'Sakshi T.', 'Neel B.', 'Siddharth V.', 'Eshan T.', 'Kabir S.', 'Naina K.', 'Rohan B.'];

const meta = {
  title: 'TV/TvCallTimeBoard',
  component: TvCallTimeBoard,
  tags: ['viewport-tv'],
  parameters: { layout: 'fullscreen' },
  decorators: [onTv],
  args: {
    title: 'Seats opening',
    emptyText: 'No one on call time.',
    moreText: (hidden: number) => `+${hidden} more`,
    seats: [
      { id: 's1', where: 'Table 1 · seat 3', name: 'Yash G.', time: '12 min' },
      { id: 's2', where: 'Table 2 · seat 6', name: 'Devansh M.', time: '18 min' },
      { id: 's3', where: 'Table 5 · seat 3', name: 'Sakshi T.', time: '41 min' },
      { id: 's4', where: 'Table 1 · seat 6', name: 'Neel B.', time: '1 h 5 min' },
      { id: 's5', where: 'Table 3 · seat 5', name: 'Siddharth V.', time: '1 h 29 min' },
      { id: 's6', where: 'Private Room · seat 2', name: 'Eshan T.', time: '2 h 10 min' },
    ],
  },
} satisfies Meta<typeof TvCallTimeBoard>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

/** Nobody on call time. */
export const Empty: Story = { args: { seats: [] } };

/** More seats than the stage holds: fourteen, and how many more. */
export const Full: Story = {
  args: {
    seats: Array.from({ length: 17 }, (_, index) => ({
      id: `s${index}`, where: `Table ${(index % 5) + 1} · seat ${(index % 9) + 1}`, name: NAMES[index % NAMES.length] ?? '',
      time: index === 0 ? 'Now' : index === 3 ? 'Away' : `${index * 9} min`,
    })),
  },
};

/** A long name keeps its whole width: its time goes under it (correction 34). A member who hid their name is their seat alone. */
export const LongText: Story = {
  args: {
    seats: [
      { id: 's1', where: 'Private Room · seat 9', name: 'Venkataraghavan R.', time: '1 h 59 min' },
      { id: 's2', where: 'Table 2 · seat 6', name: 'Devansh M.', time: '2 h 5 min' },
      { id: 's3', where: 'Table 12 · seat 10', name: 'Chandrashekhar P.', time: '2 h 41 min' },
      { id: 's4', where: 'Table 1 · seat 6', name: '', time: '2 h 50 min' },
    ],
  },
};
