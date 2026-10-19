import type { Meta, StoryObj } from '@storybook/react-vite';
import { DisplayShell } from '../DisplayShell/DisplayShell.tsx';
import { TvWaitlistBoard } from './TvWaitlistBoard.tsx';

const meta = {
  title: 'TV/TvWaitlistBoard',
  component: TvWaitlistBoard,
  tags: ['viewport-tv'],
  parameters: { layout: 'fullscreen' },
  decorators: [(Story) => <DisplayShell><Story /></DisplayShell>],
  args: {
    title: 'Waitlist',
    emptyText: 'No one waiting.',
    stakes: [
      { id: 'a', stake: '₹50/100', detail: '1 table open', places: [] },
      {
        id: 'b', stake: '₹100/200', detail: '2 tables open',
        places: [
          { id: '1', place: '1', name: 'Kabir S.', status: 'Table 3' },
          { id: '2', place: '2', name: 'Naina K.' },
          { id: '3', place: '3', name: 'Rohan B.', status: 'Away' },
        ],
      },
    ],
  },
} satisfies Meta<typeof TvWaitlistBoard>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Empty: Story = {
  args: {
    stakes: [
      { id: 'a', stake: '₹50/100', detail: 'No tables open', places: [] },
      { id: 'b', stake: '₹100/200', detail: '1 table open', places: [] },
    ],
  },
};

/** Three stakes: three columns, so all fit the stage. */
export const ThreeStakes: Story = {
  args: {
    stakes: [
      { id: 'a', stake: 'NLH 50/100', detail: '1 table open', places: [] },
      { id: 'b', stake: 'NLH 100/200', detail: '2 tables open', places: [{ id: '1', place: '1', name: 'Kabir S.' }, { id: '2', place: '2', name: 'Naina K.' }] },
      { id: 'c', stake: 'Private Room', detail: 'No tables open', places: [{ id: '3', place: '1', name: 'Vihaan K.' }] },
    ],
  },
};

/** More than six waiting: the board shows the first six. */
export const Full: Story = {
  args: {
    stakes: [{
      id: 'b', stake: '₹100/200', detail: '2 tables open',
      places: ['Kabir S.', 'Naina K.', 'Rohan B.', 'Arjun M.', 'Ishaan V.', 'Vihaan K.', 'Dev M.'].map((name, index) => ({
        id: String(index), place: String(index + 1), name,
      })),
    }],
  },
};

export const LongText: Story = {
  args: {
    stakes: [
      {
        id: 'a', stake: '₹1,000/2,000 PLO', detail: '3 tables open',
        places: [{ id: '1', place: '1', name: 'Venkataraghavan R.', status: 'Private Room' }],
      },
      { id: 'b', stake: '₹100/200', detail: '2 tables open', places: [] },
    ],
  },
};
