import type { Meta, StoryObj } from '@storybook/react-vite';
import { FaqBlock } from './FaqBlock.tsx';

const meta = {
  title: 'Website/FaqBlock',
  component: FaqBlock,
  tags: ['viewport-console'],
  parameters: { layout: 'fullscreen' },
  args: {
    heading: 'Questions',
    questions: [
      { question: 'Who can join?', answer: 'Anyone 18 or over who finishes the identity check in the app.' },
      { question: 'How do I pay?', answer: 'By UPI or in cash at the cage.' },
      { question: 'How do I get a seat?', answer: 'Join the waitlist for a game in the app; it tells you when your seat opens.' },
    ],
  },
} satisfies Meta<typeof FaqBlock>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const WithoutHeading: Story = { args: { heading: undefined } };

export const LongText: Story = {
  args: {
    questions: [
      {
        question: 'What do I need to bring the first time I come, and how long does checking in take at the front desk?',
        answer: 'The phone you signed up with. If you finished the identity check in the app, the front desk checks you in from it in under a minute; if not, bring your original Aadhaar and PAN card and staff finish the check with you.',
      },
    ],
  },
};
