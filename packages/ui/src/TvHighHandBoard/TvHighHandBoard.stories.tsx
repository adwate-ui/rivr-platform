import type { Meta, StoryObj } from '@storybook/react-vite';
import { DisplayShell } from '../DisplayShell/DisplayShell.tsx';
import { TvStage } from '../TvStage/TvStage.tsx';
import { TvHighHandBoard } from './TvHighHandBoard.tsx';

const HANDS = [
  { id: 'royal_flush', name: 'Royal flush', bonus: '25,000' },
  { id: 'straight_flush', name: 'Straight flush', bonus: '10,000' },
  { id: 'four_of_a_kind', name: 'Four of a kind', bonus: '5,000' },
];
const PAID = [
  { id: 'h2', name: 'Siddharth V.', detail: 'Four Nines · Table 3 · 01:12', bonus: '5,000' },
  { id: 'h1', name: 'Rhea S.', detail: 'Straight flush, Nine high · Table 2 · 23:40', bonus: '10,000' },
];

// The board is the stage's body: the stage draws the title, the clock and the notice line, and the TV app stands the
// board in it (HighHandMode). Each story shows it so. It has no loading or error state of its own: the TV app shows
// those in the board's place.
const meta = {
  title: 'TV/TvHighHandBoard',
  component: TvHighHandBoard,
  tags: ['viewport-tv'],
  parameters: { layout: 'fullscreen' },
  decorators: [(Story) => (
    <DisplayShell clockAt={new Date('2026-11-15T21:13:00Z')} notice="Table 4 opens at 9 tonight: Pot-Limit Omaha 100/200. Ask the floor for a seat.">
      <TvStage title="High hand bonus"><Story /></TvStage>
    </DisplayShell>
  )],
  args: {
    handsTitle: 'Hit one, get paid', hands: HANDS, rules: 'Both hole cards must play · Shown at showdown · 4 or more players dealt in',
    payoutsTitle: 'Paid tonight', payouts: PAID, emptyText: 'None yet tonight.',
  },
} satisfies Meta<typeof TvHighHandBoard>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

/** A hand was just paid: its row is lit. */
export const JustPaid: Story = {
  args: { payouts: [{ id: 'h3', name: 'Devansh M.', detail: 'Four Jacks · Table 2 · 02:43', bonus: '5,000', isNew: true }, ...PAID] },
};

export const Empty: Story = { args: { payouts: [] } };

/** All five hands of the list, more payouts than fit, a long name and a member who hid their name. */
export const LongText: Story = {
  args: {
    hands: [...HANDS, { id: 'aces_full', name: 'Aces full', bonus: '2,000' }, { id: 'full_house', name: 'Any full house', bonus: '1,000' }],
    payouts: [
      { id: 'h8', name: 'Venkataraghavan S.', detail: 'Straight flush, Queen high · Private Room · 03:05', bonus: '1,00,000', isNew: true },
      { id: 'h7', name: 'Member #17', detail: 'Kings full · Table 5 · 02:51', bonus: '1,000' },
      ...PAID,
      { id: 'h4', name: 'Kavya R.', detail: 'Aces full · Table 1 · 22:15', bonus: '2,000' },
      { id: 'h5', name: 'Ishaan V.', detail: 'Four Twos · Table 3 · 21:48', bonus: '5,000' },
      { id: 'h6', name: 'Naina K.', detail: 'Royal flush · Table 2 · 21:02', bonus: '25,000' },
    ],
  },
};
