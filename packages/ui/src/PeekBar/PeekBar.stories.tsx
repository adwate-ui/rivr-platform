import type { Meta, StoryObj } from '@storybook/react-vite';
import { PeekBar } from './PeekBar.tsx';

// The bar names a sheet it opens; it has no loading, empty or error state of its own.
const meta = {
  title: 'Navigation/PeekBar',
  component: PeekBar,
  tags: ['viewport-phone'],
  parameters: { layout: 'fullscreen' },
  args: { title: 'All tables', aside: '4 running · 2 tournaments', onOpen: () => undefined },
} satisfies Meta<typeof PeekBar>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const LongText: Story = { args: { aside: '12 running across the main room and the Private Room · 3 tournaments' } };
