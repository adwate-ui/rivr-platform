import type { Meta, StoryObj } from '@storybook/react-vite';
import { PracticeBanner } from '../PracticeBanner/PracticeBanner.tsx';
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
  args: { list: LIST, detail: RECORD, backLabel: 'Back to Members', onBack: () => undefined },
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

/** A queue beside the item open, half each (console v3: KYC review, Host queue, Website). */
export const Even: Story = { args: { layout: 'even' } };

/** The record docked in a 440 px panel at the right, the list taking the rest (console v3: Members). */
export const Docked: Story = { args: { layout: 'docked' } };

const NAMES = ['Arjun Mehta', 'Kabir Sethi', 'Naina Kapoor', 'Ishaan Verma', 'Meera Iyer', 'Dev Malhotra', 'Tara Menon', 'Ritika Das'];

/**
 * Docked beside a long list (the owner, 15 Nov night): the record stays in view as the list scrolls, as tall as the console's
 * scrolling area at most, and a longer record scrolls on its own. Here under the practice venue's stripe, as the console
 * draws it: the record's foot still shows, clear of the area's foot.
 */
export const DockedBesideALongList: Story = {
  parameters: { layout: 'fullscreen' },
  decorators: [(Story) => (
    <div className="flex h-dvh flex-col">
      <PracticeBanner message="Practice venue: nothing here reaches the club or its members." action={{ label: 'Back to the club', onPress: () => undefined }} />
      <div data-scroller="" className="console-view min-h-0 flex-1 overflow-y-auto px-4 pt-7 pb-10"><Story /></div>
    </div>
  )],
  args: {
    layout: 'docked',
    list: <Stack gap={3}>{Array.from({ length: 40 }, (_, index) => <Text key={index} weight="medium">{NAMES[index % NAMES.length]}</Text>)}</Stack>,
    detail: (
      <Screen title="Arjun Mehta">
        <Stack gap={3}>{Array.from({ length: 30 }, (_, index) => <Text key={index} tone="muted">Visit {index + 1} · Table 3 · 2 h 10 min</Text>)}</Stack>
      </Screen>
    ),
  },
};

/** On a phone, a record shown only because none is chosen yet (the floor's first table) leaves the list in place. */
export const NotChosenOnAPhone: Story = { args: { isChosen: false }, tags: ['!viewport-console', 'viewport-phone'] };
