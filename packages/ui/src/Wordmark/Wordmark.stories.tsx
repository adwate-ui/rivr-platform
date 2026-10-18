import type { Meta, StoryObj } from '@storybook/react-vite';
import { Wordmark } from './Wordmark.tsx';

const meta = {
  title: 'Type/Wordmark',
  component: Wordmark,
} satisfies Meta<typeof Wordmark>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const WithTagline: Story = { args: { withTagline: true } };

export const Large: Story = { args: { size: 'lg', withTagline: true } };

/** The sign-in lockup: centred, with the motto. */
export const SignIn: Story = { args: { size: 'lg', withTagline: true, withMotto: true, align: 'center' } };
