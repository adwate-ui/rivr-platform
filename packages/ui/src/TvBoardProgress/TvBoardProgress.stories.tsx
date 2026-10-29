import type { Meta, StoryObj } from '@storybook/react-vite';
import { DisplayShell } from '../DisplayShell/DisplayShell.tsx';
import { Heading } from '../Heading/Heading.tsx';
import { TvBoardProgress } from './TvBoardProgress.tsx';

const meta = {
  title: 'TV/TvBoardProgress',
  component: TvBoardProgress,
  tags: ['viewport-tv'],
  parameters: { layout: 'fullscreen' },
  decorators: [(Story) => <DisplayShell><Heading level={1} variant="display">Waitlist</Heading><Story /></DisplayShell>],
  args: { durationMs: 30_000 },
} satisfies Meta<typeof TvBoardProgress>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * A board's half minute: the bar fills along the stage's foot, then starts again. The visual test stops animations, so
 * it shows the bar still and full, as reduced motion does; TvBoardProgress.test.tsx holds the timing.
 */
export const Default: Story = {};
