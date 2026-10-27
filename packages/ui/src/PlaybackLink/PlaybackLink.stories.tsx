import type { Meta, StoryObj } from '@storybook/react-vite';
import { PlaybackLink } from './PlaybackLink.tsx';

// It holds no data, so it has no empty state of its own: Default is a recording not asked for yet.
const meta = {
  title: 'Controls/PlaybackLink',
  component: PlaybackLink,
  args: { state: { status: 'idle' }, onAsk: () => undefined },
} satisfies Meta<typeof PlaybackLink>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Loading: Story = { args: { state: { status: 'asking' } } };

export const Ready: Story = { args: { state: { status: 'ready', url: 'https://cctv.invalid/playback?camera=ch-2', camera: 'Table 2 overhead' } } };

export const NoCamera: Story = { args: { state: { status: 'failed', reason: 'no_camera' } } };

/** The link did not come: Playback is offered again beside the reason. */
export const WithError: Story = { args: { state: { status: 'failed', reason: 'unavailable' } } };

export const LongText: Story = {
  args: { state: { status: 'ready', url: 'https://cctv.invalid/playback?camera=ch-2', camera: 'Main floor, north-east corner, wide angle over Tables 7 and 8' } },
};
