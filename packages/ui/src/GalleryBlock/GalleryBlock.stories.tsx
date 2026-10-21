import type { Meta, StoryObj } from '@storybook/react-vite';
import { WebBand } from '../WebBand/WebBand.tsx';
import { GalleryBlock } from './GalleryBlock.tsx';

const ITEMS = [
  { image: '/media/members.webp', alt: 'A host greets members at the club\'s door', title: 'A private members\' club', text: 'Members and their guests only.' },
  { image: '/media/dealers.webp', alt: 'A dealer in a waistcoat deals at a table', title: 'Casino-trained dealers', text: 'Fast, accurate, fair.' },
  { image: '/media/cashier.webp', alt: 'A cashier counts chips at the cage', title: 'Instant, secure cashier', text: 'Clean counts, paid the same night.' },
  { image: '/media/private-room.webp', alt: 'A private table under a single lamp', title: 'Private high-stakes room', text: 'Discreet, for bigger action.' },
];

// Shown in a cream band, as the front page places it. A gallery has no loading or error state: its stills
// are the website's own files.
const meta = {
  title: 'Website/GalleryBlock',
  component: GalleryBlock,
  tags: ['viewport-console'],
  parameters: { layout: 'fullscreen' },
  decorators: [(Story) => <WebBand tone="cream"><Story /></WebBand>],
  args: {
    eyebrow: 'The RIVR difference',
    heading: 'Built for the long session.',
    intro: 'Everything around the table is looked after, so the game is all you think about.',
    items: ITEMS,
    note: 'Concept visualisation',
  },
} satisfies Meta<typeof GalleryBlock>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const OnAPhone: Story = { tags: ['!viewport-console', 'viewport-phone'] };

export const WithoutHeading: Story = { args: { eyebrow: undefined, heading: undefined, intro: undefined } };

export const LongText: Story = {
  args: {
    items: ITEMS.map((item) => ({ ...item, title: `${item.title} for every member`, text: `${item.text ?? ''} Every night the club is open, from the first hand to the last.` })),
  },
};
