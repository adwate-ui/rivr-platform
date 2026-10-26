import type { Meta, StoryObj } from '@storybook/react-vite';
import { CardsBlock } from './CardsBlock.tsx';

const meta = {
  title: 'Website/CardsBlock',
  component: CardsBlock,
  tags: ['viewport-console'],
  parameters: { layout: 'fullscreen' },
  args: {
    eyebrow: 'What we stand for',
    heading: 'Play. Connect. Belong.',
    intro: 'Three words on every RIVR poster, and three promises to every member who walks in.',
    cards: [
      { label: '01 · Play', title: 'The game, done properly.', text: 'Poker is a game of skill, so we run it like one.', points: ['Professional dealers on rotation', 'Hold’em and Omaha'] },
      { label: '02 · Connect', title: 'A room full of regulars.', text: 'The best part of a good game is who sits across from you.', points: ['Weekly tournaments', 'A lounge between sessions'] },
      { label: '03 · Belong', title: 'Members, not customers.', text: 'Everyone here is verified, known and looked after.', points: ['Tiers that rise with your hours'], link: { label: 'See membership', href: '#' } },
    ],
    quote: 'The only thing on your mind should be the next decision.',
  },
} satisfies Meta<typeof CardsBlock>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

/** Four cards, two across. */
export const Four: Story = {
  args: {
    eyebrow: undefined, heading: 'How to join', intro: undefined, quote: undefined,
    cards: ['Sign up', 'Verify your ID', 'Check in', 'Take your seat'].map((title, index) => ({ label: `0${String(index + 1)}`, title, text: 'One step, done in minutes.' })),
    action: { label: 'Join RIVR', href: '#' },
  },
};

export const LongText: Story = {
  args: { cards: [{ label: 'A long label above it', title: 'A card title that runs long', text: 'An unusually long line, as an owner might write it in the console, to see that it wraps cleanly and never breaks the band.', points: ['An unusually long line, as an owner might write it in the console, to see that i'] }, { title: 'Short' }] },
};
