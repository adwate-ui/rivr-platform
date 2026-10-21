import type { Meta, StoryObj } from '@storybook/react-vite';
import { TextBlock } from '../TextBlock/TextBlock.tsx';
import { WebBand } from './WebBand.tsx';

// A band holds one website block; it has no loading, empty or error state of its own.
const meta = {
  title: 'Website/WebBand',
  component: WebBand,
  tags: ['viewport-console'],
  parameters: { layout: 'fullscreen' },
  args: {
    tone: 'dark',
    children: <TextBlock heading="A members' club" body="Cash games and tournaments with dealers at every table, and a cage that pays out the same night." />,
  },
} satisfies Meta<typeof WebBand>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Dark: Story = {};

export const Deep: Story = { args: { tone: 'deep' } };

export const Cream: Story = { args: { tone: 'cream' } };

export const LongText: Story = {
  args: {
    tone: 'cream',
    children: <TextBlock heading="Played straight, every hand" body={'Every table has a dealer trained to casino standard, and every hand is logged at the table as it is dealt.\n\nThe cage counts every chip in and out, and pays out the same night, in cash or to your wallet.'} />,
  },
};
