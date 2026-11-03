import type { Meta, StoryObj } from '@storybook/react-vite';
import { Skeleton } from './Skeleton.tsx';

// The skeleton is the loading state itself.
const meta = {
  title: 'Feedback/Skeleton',
  component: Skeleton,
} satisfies Meta<typeof Skeleton>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const OneRow: Story = { args: { rows: 1 } };

/** The console's list (console v3): a heading, a line and 44 px rows. */
export const Rows: Story = { args: { look: 'rows', rows: 6 } };

/** The live floor's tiles (console v3). */
export const Tiles: Story = { args: { look: 'tiles', rows: 6 } };
