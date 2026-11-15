import type { Meta, StoryObj } from '@storybook/react-vite';
import { ConsoleFrameContext } from '../internal/consoleFrame.ts';
import { StakeValues, type StakeValue } from './StakeValues.tsx';

const STAKES: readonly StakeValue[] = [
  { id: 's1', name: 'NLH 50/100', value: 3 },
  { id: 's2', name: 'NLH 100/200/500', value: 3 },
  { id: 's3', name: 'PLO 100/200', value: 4 },
];

// The editor has no loading state of its own: the panel that holds it carries the setting's loading and saving.
const meta = {
  title: 'Controls/StakeValues',
  component: StakeValues,
  args: { label: 'Call time', stakes: STAKES, unit: 'hours', min: 1, max: 12, onChange: () => undefined },
  // As in the console's panel at the side of the screen: 440 px wide, its content 24 px in, the console's own looks.
  decorators: [(Story) => <ConsoleFrameContext value><div className="w-side-panel max-w-full bg-raised px-6 py-5"><Story /></div></ConsoleFrameContext>],
} satisfies Meta<typeof StakeValues>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

/** A stake that has no value yet keeps its line, and says so. */
export const AStakeWithNone: Story = { args: { stakes: [...STAKES, { id: 's4', name: 'NLH 200/400', value: null }] } };

/** Refused: a value outside the range, said under its own stake. */
export const OutOfRange: Story = { args: { stakes: [{ id: 's1', name: 'NLH 50/100', value: 3 }, { id: 's2', name: 'NLH 100/200/500', value: 40 }] } };

/** The club has no stakes yet. */
export const Empty: Story = { args: { stakes: [] } };

export const LongText: Story = { args: { stakes: [{ id: 's1', name: 'No-limit hold\'em 100/200 with a straddle of 500, in the private room', value: 1 }] } };

/** At a desk the fields are 36 px. */
export const AtADesk: Story = { tags: ['viewport-console'] };

/** On a phone the panel is the screen's width. */
export const OnAPhone: Story = { args: { stakes: [...STAKES, { id: 's4', name: 'NLH 200/400', value: null }] }, tags: ['viewport-phone'] };
