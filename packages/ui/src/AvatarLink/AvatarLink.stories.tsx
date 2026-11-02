import type { Meta, StoryObj } from '@storybook/react-vite';
import { AvatarLink } from './AvatarLink.tsx';

// The link shows the member's initial; before it is known, a profile icon is its loading state.
const meta = {
  title: 'Navigation/AvatarLink',
  component: AvatarLink,
  args: { initial: 'I', href: '#profile' },
} satisfies Meta<typeof AvatarLink>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Loading: Story = { args: { initial: undefined } };
