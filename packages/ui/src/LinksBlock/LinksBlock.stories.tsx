import type { Meta, StoryObj } from '@storybook/react-vite';
import { WebBand } from '../WebBand/WebBand.tsx';
import { LinksBlock } from './LinksBlock.tsx';

const meta = {
  title: 'Website/LinksBlock',
  component: LinksBlock,
  parameters: { layout: 'fullscreen' },
  args: {
    links: [
      { label: 'Join the waitlist', href: '#waitlist' },
      { label: 'Book RIVR Academy', href: '#academy' },
      { label: 'Join RIVR', href: '#sign-up' },
    ],
  },
} satisfies Meta<typeof LinksBlock>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const WithHeading: Story = { args: { heading: 'RIVR Poker Club' } };

/** On a cream band (F-193): the gold button's edge and the outlined buttons' edges in ink. */
export const OnACreamBand: Story = {
  args: { heading: 'RIVR Poker Club' },
  decorators: [(Story) => <WebBand tone="cream"><Story /></WebBand>],
};

export const LongText: Story = {
  args: { links: [{ label: 'Join the waitlist for tonight\'s 100/200 game in the Private Room', href: '#waitlist' }] },
};
