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
