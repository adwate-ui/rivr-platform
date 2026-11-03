import type { Meta, StoryObj } from '@storybook/react-vite';
import { Button } from '../Button/Button.tsx';
import { ChoiceChips } from '../ChoiceChips/ChoiceChips.tsx';
import { Skeleton } from '../Skeleton/Skeleton.tsx';
import { Stack } from '../Stack/Stack.tsx';
import { Text } from '../Text/Text.tsx';
import { Sheet } from './Sheet.tsx';

// A sheet holds what a screen asks; its content carries any loading or error state.
const meta = {
  title: 'Controls/Sheet',
  component: Sheet,
  parameters: { layout: 'fullscreen' },
  args: {
    isOpen: true,
    onClose: () => undefined,
    title: 'Top up',
    children: (
      <Stack gap={4}>
        <Button variant="primary" size="tall" fullWidth>Request top-up</Button>
        <Button variant="text" fullWidth>Cancel</Button>
      </Stack>
    ),
  },
} satisfies Meta<typeof Sheet>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const WithEyebrow: Story = { args: { eyebrow: 'Redeem', title: 'Bar upgrade, one night' } };

export const PlainWithAside: Story = {
  args: { title: 'Occupation', titleLook: 'plain', aside: 'Choose one', children: <Text tone="muted">Options</Text> },
};

export const LongText: Story = {
  args: { eyebrow: 'Private Room', title: "No-Limit Hold'em 100/200 with a straddle and a bomb pot every orbit" },
};

const consoleBody = (
  <>
    <ChoiceChips label="Add time" look="subtle" mode="one" options={[{ value: '30', label: '30 min' }, { value: '60', label: '1 h' }, { value: '120', label: '2 h' }]}
      selected={['60']} onChange={() => undefined} />
    <Text tone="muted">Call time 2 h 56 min left, since 11:35.</Text>
  </>
);

const consoleFooter = (
  <>
    <Button variant="text" size="compact">Cancel</Button>
    <Button variant="primary" size="compact">Add 1 h</Button>
  </>
);

/** The console's sheet at a desk (console v3): a 440 px panel down the right, its title and actions staying. */
export const Console: Story = {
  tags: ['viewport-console'],
  args: { place: 'console', title: 'Vidya Chadha', subtitle: 'Table 1, seat 2 · Academy graduate', children: consoleBody, footer: consoleFooter },
};

/** The console's sheet on a phone: from the foot to just under the top. */
export const ConsoleOnAPhone: Story = { tags: ['viewport-phone'], args: { ...Console.args } };

export const ConsoleLoading: Story = { tags: ['viewport-console'], args: { ...Console.args, children: <Skeleton look="rows" rows={4} />, footer: undefined } };

export const ConsoleLongText: Story = {
  tags: ['viewport-console'],
  args: { ...Console.args, title: 'Venkataraghavan Subramaniam-Krishnamurthy', subtitle: 'Private Room upstairs by the bar, seat 9 · Founders’ Circle' },
};
