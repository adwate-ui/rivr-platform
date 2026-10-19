import type { Meta, StoryObj } from '@storybook/react-vite';
import { CareersBlock } from './CareersBlock.tsx';

const meta = {
  title: 'Website/CareersBlock',
  component: CareersBlock,
  tags: ['viewport-console'],
  parameters: { layout: 'fullscreen' },
  args: {
    heading: 'Careers',
    roles: [
      { title: 'Dealer', body: 'Deal hold\'em and Omaha on the night shift. We train you before the club opens.' },
      { title: 'Floor supervisor', body: 'Run the waitlist and the tables on your shift, with the console.' },
    ],
    apply: 'Send your name and the role to the front desk on WhatsApp.',
  },
} satisfies Meta<typeof CareersBlock>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Empty: Story = { args: { roles: [], apply: undefined } };

export const LongText: Story = {
  args: {
    roles: [
      {
        title: 'Cage cashier, night shift, with two years at a bank counter or a casino cage',
        body: 'Count, pay out and record every buy-in and cash-out on the cage computer, with a second cashier approving the large ones. Training on the RIVR console before opening night.',
      },
    ],
  },
};
