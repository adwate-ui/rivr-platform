import type { Meta, StoryObj } from '@storybook/react-vite';
import { TimelineBlock } from './TimelineBlock.tsx';

const meta = {
  title: 'Website/TimelineBlock',
  component: TimelineBlock,
  tags: ['viewport-console'],
  parameters: { layout: 'fullscreen' },
  args: {
    eyebrow: 'On the record',
    heading: 'Not luck. A game of skill.',
    intro: 'Indian courts have long held that a game of skill is not gambling.',
    items: [
      { when: '1968', title: 'State of Andhra Pradesh v. K. Satyanarayana', text: 'The Supreme Court holds rummy a game of skill.' },
      { when: '1996', title: 'K.R. Lakshmanan v. State of Tamil Nadu', text: 'The Supreme Court sets out the test: where skill predominates over chance.' },
      { when: '2026', title: 'RIVR opens in Gurugram', text: 'A members’ club for poker, played as a game of skill.' },
    ],
  },
} satisfies Meta<typeof TimelineBlock>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

/** Each ruling linked to its judgment (#619). */
export const WithLinks: Story = {
  args: {
    items: [
      { when: '1996', title: 'K.R. Lakshmanan v. State of Tamil Nadu', text: 'The Supreme Court sets out the test: where skill predominates over chance.',
        link: { label: 'Read the judgment', href: 'https://indiankanoon.org/doc/1248365/' } },
      { when: '2013', title: 'Indian Poker Association v. State of Karnataka', text: 'Poker played as a game of skill needs no gaming licence.',
        link: { label: 'Read the judgment', href: 'https://indiankanoon.org/doc/28000869/' } },
    ],
  },
};

export const LongText: Story = {
  args: { items: [{ when: '14 Nov 2026', title: 'An unusually long line, as an owner might write it in the console, to see that it wraps cleanly and ', text: 'An unusually long line, as an owner might write it in the console, to see that it wraps cleanly and never breaks the band.' }] },
};
