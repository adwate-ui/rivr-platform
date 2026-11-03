import type { Meta, StoryObj } from '@storybook/react-vite';
import { PracticeBanner } from './PracticeBanner.tsx';

// A banner of a state that is on has no loading, empty or error state: it shows while the practice venue is on.
const meta = {
  title: 'Shells/PracticeBanner',
  component: PracticeBanner,
  tags: ['viewport-console'],
  parameters: { layout: 'fullscreen' },
  args: {
    message: 'Practice venue: nothing here reaches the club or its members.',
    action: { label: 'Back to the club', onPress: () => undefined },
  },
} satisfies Meta<typeof PracticeBanner>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Across the top of the console at a desk. */
export const Default: Story = {};

/** On a phone, the words wrap beside the button. */
export const OnAPhone: Story = { tags: ['!viewport-console', 'viewport-phone'] };

/** A longer line, as at a second practice venue, wrapping on a phone beside the button. */
export const LongText: Story = {
  tags: ['!viewport-console', 'viewport-phone'],
  args: { message: 'Practice venue, RIVR Training Room: nothing here reaches the club, its members or its records.' },
};

/** Going back to the club: the button held. */
export const GoingBack: Story = { args: { action: { label: 'Back to the club', onPress: () => undefined, isPending: true } } };
