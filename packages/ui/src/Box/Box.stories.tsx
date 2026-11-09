import type { Meta, StoryObj } from '@storybook/react-vite';
import { Grid } from '../Grid/Grid.tsx';
import { CONSOLE_MAIN_TOP } from '../internal/consoleMain.ts';
import { Stack } from '../Stack/Stack.tsx';
import { Text } from '../Text/Text.tsx';
import { Box } from './Box.tsx';

const meta = {
  title: 'Layout/Box',
  component: Box,
  args: {
    padding: 4,
    surface: 'raised',
    radius: 'lg',
    children: <Text>Table 3 · 100/200 · 2 seats open</Text>,
  },
} satisfies Meta<typeof Box>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Hairline: Story = { args: { surface: 'none', hairline: 'bottom', radius: 'none' } };

export const CreamTile: Story = { args: { surface: 'cream', children: <Text tone="onCream">Black card</Text> } };

export const LongText: Story = {
  args: {
    children: (
      <Text>
        The Private Room seats nine at 1,000/2,000 with a ₹2,00,000 minimum buy-in. Seats are held for fifteen minutes after a call, then
        offered to the next member on the waitlist.
      </Text>
    ),
  },
};

/** Beside a longer column (the promotion builder, console v3): its own height, held at the top as the page scrolls. */
export const StickyBesideALongerColumn: Story = {
  render: () => (
    <Grid columns={2} gap={6} stackBelow="medium">
      <Stack gap={4}>
        {['1 · Reward', '2 · Who qualifies', '3 · When', '4 · Limits', '5 · Where it shows'].map((section) => (
          <Box key={section} surface="raised" radius="lg" padding={5}><Text>{section}</Text></Box>
        ))}
      </Stack>
      <Box isSticky surface="raised" hairline="all" radius="lg" padding={4}>
        <Text>2× points, for all stakes, Fri, Sat 20:00–02:00. Once per visit per member. Starts 6 Nov 2026, no end date.</Text>
      </Box>
    </Grid>
  ),
  tags: ['viewport-console'],
};

/** A long form's actions in the console's main, with its padding (F-029): scrolled down, the bar sits against main's top edge, the column passing under it. */
export const StickyBarOverALongColumn: Story = {
  render: () => (
    <div data-scroller="" className={`h-dvh overflow-y-auto px-4 ${CONSOLE_MAIN_TOP}`}>
      <Stack gap={4}>
        <Box isStickyBar surface="raised" paddingY={3}><Text>Save draft · Publish now</Text></Box>
        {Array.from({ length: 24 }, (_, index) => (
          <Box key={index} surface="raised" radius="lg" padding={5}><Text>{`Field ${String(index + 1)}`}</Text></Box>
        ))}
      </Stack>
    </div>
  ),
  play: ({ canvasElement }) => {
    canvasElement.querySelector('[data-scroller]')?.scrollTo(0, 400);
  },
  parameters: { layout: 'fullscreen' },
  tags: ['viewport-console'],
};
