import type { Meta, StoryObj } from '@storybook/react-vite';
import { TextBlock } from './TextBlock.tsx';

const meta = {
  title: 'Website/TextBlock',
  component: TextBlock,
  tags: ['viewport-console'],
  parameters: { layout: 'fullscreen' },
  args: {
    heading: "A members' club",
    body: 'Cash games and tournaments with dealers at every table, a cage that pays out the same night, and a floor you can follow from your phone.',
  },
} satisfies Meta<typeof TextBlock>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const WithoutHeading: Story = { args: { heading: undefined } };

export const LongText: Story = {
  args: {
    body:
      'Cash games run every night from seven, at stakes from 25/50 to 1,000/2,000. A floor manager seats the waitlist in order, and the app tells you when your seat opens.\n\n' +
      'Tournaments run on the weekend, with a calendar on this website and entry from the app. The cage pays out the same night, by UPI or in cash.',
  },
};
