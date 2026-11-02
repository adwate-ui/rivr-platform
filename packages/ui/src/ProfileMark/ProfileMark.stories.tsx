import type { Meta, StoryObj } from '@storybook/react-vite';
import { ProfileMark } from './ProfileMark.tsx';

// The mark shows what it is given; until a photo comes, the initial is its loading state.
const meta = {
  title: 'Data/ProfileMark',
  component: ProfileMark,
  args: { initial: 'I' },
} satisfies Meta<typeof ProfileMark>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
