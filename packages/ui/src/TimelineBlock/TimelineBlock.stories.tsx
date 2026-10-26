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
