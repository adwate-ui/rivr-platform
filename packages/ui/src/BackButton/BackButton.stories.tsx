import type { Meta, StoryObj } from '@storybook/react-vite';
import { BackButton } from './BackButton.tsx';

// It goes back; the screen it sits on carries any loading or error state.
const meta = {
  title: 'Navigation/BackButton',
  component: BackButton,
  args: { label: 'Tonight', onBack: () => undefined },
} satisfies Meta<typeof BackButton>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const LongText: Story = { args: { label: 'Back to the club\'s house rules and the legal standing' } };
