import type { Meta, StoryObj } from '@storybook/react-vite';
import { BrandArt } from './BrandArt.tsx';

// Brand art is a static render for @rivr/render's brand kit: it has no loading, empty or error
// state, and no text beyond the wordmark. It fills the page; here, the component window.
const meta = {
  title: 'Brand/BrandArt',
  component: BrandArt,
  parameters: { layout: 'fullscreen' },
  args: { art: 'icon' },
} satisfies Meta<typeof BrandArt>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Icon: Story = {};

export const Maskable: Story = { args: { art: 'maskable' } };

export const Adaptive: Story = { args: { art: 'adaptive' } };

export const Lockup: Story = { args: { art: 'lockup' } };
