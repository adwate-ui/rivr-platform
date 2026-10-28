import type { Meta, StoryObj } from '@storybook/react-vite';
import { Screen } from '../Screen/Screen.tsx';
import { Stack } from '../Stack/Stack.tsx';
import { Text } from '../Text/Text.tsx';
import { SplitView } from './SplitView.tsx';

const LIST = (
  <Stack gap={3}>
    <Text weight="medium">Arjun Mehta</Text>
    <Text weight="medium">Kabir Sethi</Text>
    <Text weight="medium">Naina Kapoor</Text>
  </Stack>
);

const RECORD = (
  <Screen title="Arjun Mehta">
    <Text tone="muted">Member 10201 · Black card · KYC verified</Text>
  </Screen>
);

const meta = {
  title: 'Layout/SplitView',
  component: SplitView,
  tags: ['viewport-console'],
  args: { list: LIST, detail: RECORD, backLabel: 'Back to Members', onBack: () => undefined, emptyText: 'Choose a member to see their record.' },
} satisfies Meta<typeof SplitView>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const NothingOpen: Story = { args: { detail: null } };

/** On a phone the record replaces the list, with the way back above it. */
export const OnAPhone: Story = { tags: ['!viewport-console', 'viewport-phone'] };

/** A tablet held upright: one at a time, as on a phone. */
export const OnAPortraitTablet: Story = { tags: ['!viewport-console', 'viewport-portrait'] };

/** A long name and a long line of the record wrap within their columns. */
export const LongText: Story = {
  args: {
    list: (
      <Stack gap={3}>
        <Text weight="medium">Arjun Mehta, who has a much longer name than any member has</Text>
        <Text weight="medium">Kabir Sethi</Text>
      </Stack>
    ),
    detail: (
      <Screen title="Arjun Mehta, who has a much longer name than any member has">
        <Text tone="muted">Member 10201 · Black card · KYC verified · A regular at the 100/200 tables since the club opened</Text>
      </Screen>
    ),
  },
};

/** On a phone, a record shown only because none is chosen yet (the floor's first table) leaves the list in place. */
export const NotChosenOnAPhone: Story = { args: { isChosen: false }, tags: ['!viewport-console', 'viewport-phone'] };
