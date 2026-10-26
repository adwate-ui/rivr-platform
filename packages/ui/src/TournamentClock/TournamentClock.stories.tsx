import type { Meta, StoryObj } from '@storybook/react-vite';
import { Button } from '../Button/Button.tsx';
import { TournamentClock } from './TournamentClock.tsx';

const meta = {
  title: 'Console/TournamentClock',
  component: TournamentClock,
  args: {
    title: 'RIVR Sunday · level 7',
    remaining: '11:34',
    blinds: '400/800 ante 800',
    next: 'Next 500/1,000 ante 1,000',
    actions: (
      <>
        <Button variant="primary">Pause</Button>
        <Button variant="text">Previous level</Button>
        <Button variant="text">Next level</Button>
      </>
    ),
    stats: [
      { label: 'Entries', value: '58' },
      { label: 'Re-entries', value: '11' },
      { label: 'Left', value: '31' },
      { label: 'Average stack', value: '56,129' },
      { label: 'Pool', value: '₹5,22,000' },
    ],
  },
} satisfies Meta<typeof TournamentClock>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

/** Paused by the floor: the clock holds and says so. */
export const Paused: Story = { args: { status: 'Paused', actions: <Button variant="primary">Resume</Button> } };

/** Before the start: level 1 in full, no figures yet. */
export const Empty: Story = {
  args: { title: 'RIVR Sunday · level 1', remaining: '20:00', blinds: '100/100 ante 100', next: 'Next 100/200 ante 200', status: 'Not started', stats: [],
    actions: <Button variant="primary">Start the clock</Button> },
};

/** A break, on the last level's clock: no next level. */
export const Break: Story = { args: { title: 'RIVR Sunday · level 9', remaining: '14:59', blinds: 'Break', next: undefined } };

/** A long name and a big field's figures wrap rather than overflow. */
export const LongText: Story = {
  args: {
    title: 'RIVR Sunday Championship, Day 2 Final Table, Re-entry and Bounty · level 27',
    blinds: '1,00,000/2,00,000 ante 2,00,000',
    next: 'Next 1,50,000/3,00,000 ante 3,00,000',
    stats: [
      { label: 'Entries', value: '1,234' }, { label: 'Re-entries', value: '456' }, { label: 'Left', value: '9' },
      { label: 'Average stack', value: '41,13,333' }, { label: 'Pool', value: '₹1,11,06,000' },
    ],
  },
};
