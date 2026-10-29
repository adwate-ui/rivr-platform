import type { Meta, StoryObj } from '@storybook/react-vite';
import { GamesBlock } from './GamesBlock.tsx';

const meta = {
  title: 'Website/GamesBlock',
  component: GamesBlock,
  tags: ['viewport-console'],
  parameters: { layout: 'fullscreen' },
  args: {
    heading: 'Games and stakes',
    games: [
      { name: 'NLH 50/100', smallBlind: 5000n, bigBlind: 10000n, buyInMin: 500000n, buyInMax: 500000n, straddle: null },
      { name: 'NLH 100/200', smallBlind: 10000n, bigBlind: 20000n, buyInMin: 1000000n, buyInMax: 1000000n, straddle: null },
      { name: 'Private Room', smallBlind: 10000n, bigBlind: 20000n, buyInMin: 2000000n, buyInMax: 2000000n, straddle: 50000n },
    ],
    reserve: { label: 'Reserve a seat', href: 'https://wa.me/910000000000' },
  },
} satisfies Meta<typeof GamesBlock>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Empty: Story = { args: { games: [] } };

export const LongText: Story = {
  args: {
    games: [
      {
        name: 'Pot-limit Omaha high, five cards, the Sunday night game',
        smallBlind: 50000n,
        bigBlind: 100000n,
        buyInMin: 10000000n,
        buyInMax: 50000000n,
        straddle: 200000n,
      },
    ],
  },
};
