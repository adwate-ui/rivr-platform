import type { Meta, StoryObj } from '@storybook/react-vite';
import { Stack } from '../Stack/Stack.tsx';
import { Heading } from './Heading.tsx';

const meta = {
  title: 'Type/Heading',
  component: Heading,
  args: { level: 1, children: 'Balance' },
} satisfies Meta<typeof Heading>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Levels: Story = {
  render: () => (
    <Stack gap={3}>
      <Heading level={1} variant="display">
        RIVR Sunday
      </Heading>
      <Heading level={1}>Balance</Heading>
      <Heading level={2}>Movements</Heading>
      <Heading level={3}>Markers</Heading>
    </Stack>
  ),
};

export const LongText: Story = {
  args: { children: 'Tournament registration and late entry for the RIVR Sunday main event' },
};

/** A TV title, its optical size held low so its hairlines show from across a room (D-01). */
export const TvTitle: Story = { tags: ['viewport-tv'], args: { level: 1, variant: 'tvTitle', children: 'High hands' } };

/** A code staff type in from across a room, in the text face, whose 4 never reads as a 1 (D-01). */
export const TvCode: Story = { tags: ['viewport-tv'], args: { level: 2, variant: 'tvCode', children: '481 447' } };

/** The player redesign's titles in the display face (decision 0320): a screen's at 36, a sheet's at 32. */
export const Serif: Story = { args: { level: 1, variant: 'serif', children: 'Sessions' } };

export const SerifSheet: Story = { args: { level: 2, variant: 'serif', serifSize: 32, children: 'Leave your seat?' } };

/** A section of a player tab, in gold capitals, as Rewards' Your redemptions and RIVR League (F-172). */
export const Eyebrow: Story = { args: { level: 2, variant: 'eyebrow', children: 'Your redemptions' } };
