import type { Meta, StoryObj } from '@storybook/react-vite';
import { RulesBlock } from './RulesBlock.tsx';

const meta = {
  title: 'Website/RulesBlock',
  component: RulesBlock,
  tags: ['viewport-console'],
  parameters: { layout: 'fullscreen' },
  args: {
    heading: 'House rules',
    rules: [
      'Members only. Bring the phone you signed up with; the front desk checks you in from it.',
      'One player to a hand. No advice from the rail.',
      'Chips stay on the table until you cash out at the cage.',
    ],
  },
} satisfies Meta<typeof RulesBlock>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const WithoutHeading: Story = { args: { heading: undefined } };

export const LongText: Story = {
  args: {
    rules: [
      'Members only. Bring the phone you signed up with; the front desk checks you in from it, and a guest signs up at the desk with an original Aadhaar and PAN card before they play.',
      'The floor manager decides any dispute at the table, and their decision is final for that hand.',
    ],
  },
};
