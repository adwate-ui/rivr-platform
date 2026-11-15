import type { Meta, StoryObj } from '@storybook/react-vite';
import { SummaryStrip } from './SummaryStrip.tsx';

// A strip shows figures it is given; it has no loading or error state of its own: the screen leaves it out until they are read.
const meta = {
  title: 'Console/SummaryStrip',
  component: SummaryStrip,
  args: {
    label: 'High hand bonus', lead: '2 hands paid tonight', facts: ['15,000 Bonus'], detail: 'Last: Siddharth Vaid, Four Nines, 01:12',
    action: { label: 'Log a high hand', onPress: () => undefined },
  },
} satisfies Meta<typeof SummaryStrip>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

/** Nothing yet tonight: the lead alone, and the action. */
export const Empty: Story = { args: { lead: 'No hands paid tonight', facts: [], detail: undefined } };

/** For staff who read it and may not act. */
export const NoAction: Story = { args: { action: undefined } };

/** Five-figure numbers and a long name in a narrow column: still one line, the detail cut short. */
export const LongText: Story = {
  args: { lead: '12 hands paid tonight', facts: ['1,25,000 Bonus'], detail: 'Last: Venkataraghavan Subramanian-Iyer, Straight flush, Queen high, 02:43' },
  decorators: [(Story) => <div className="max-w-text"><Story /></div>],
};
