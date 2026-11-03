import type { Meta, StoryObj } from '@storybook/react-vite';
import { Box } from '../Box/Box.tsx';
import { Heading } from '../Heading/Heading.tsx';
import { Inline } from '../Inline/Inline.tsx';
import { PlayerShell } from '../PlayerShell/PlayerShell.tsx';
import { Stack } from '../Stack/Stack.tsx';
import { PLAYER_TABS } from '../storybook/fixtures.ts';
import { Text } from '../Text/Text.tsx';
import { Wordmark } from '../Wordmark/Wordmark.tsx';
import { PlayerAvatar } from './PlayerAvatar.tsx';

/** A header of a screen's own, as Tonight's, with the initial at its right, centred on what heads it (decision 0380). */
function Header({ isSeated }: { isSeated: boolean }) {
  return (
    <PlayerShell tabs={PLAYER_TABS} currentTab="home" avatar={{ initial: 'I', href: '#profile' }} isFullBleed>
      <Box paddingX={5}>
        <Inline gap={4} justify="between">
          {isSeated ? (
            <Stack gap={1}>
              <Heading level={2} variant="serif" serifSize={28}>Table 1 · Seat 4</Heading>
              <Text variant="small" tone="muted">NLH 50/100 · playing 19 min</Text>
            </Stack>
          ) : <Wordmark />}
          <PlayerAvatar />
        </Inline>
      </Box>
    </PlayerShell>
  );
}

const meta = {
  title: 'Navigation/PlayerAvatar',
  component: Header,
  tags: ['viewport-phone'],
  parameters: { layout: 'fullscreen' },
  args: { isSeated: false },
} satisfies Meta<typeof Header>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Browsing: the wordmark and the initial on one centre line. */
export const Default: Story = {};

/** Seated: the initial centred on the header's two lines. */
export const Seated: Story = { args: { isSeated: true } };
