import type { Meta, StoryObj } from '@storybook/react-vite';
import { SuggestionCard } from './SuggestionCard.tsx';

// The card is shown only with something to suggest; it has no loading, empty or error state of its own.
const meta = {
  title: 'Controls/SuggestionCard',
  component: SuggestionCard,
  args: { title: 'Your usual', text: 'Masala chai, Club sandwich', actionLabel: 'Add both', onPress: () => undefined },
} satisfies Meta<typeof SuggestionCard>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const LongText: Story = { args: { text: 'Fresh lime soda with no sugar, Paneer tikka with extra mint chutney' } };
