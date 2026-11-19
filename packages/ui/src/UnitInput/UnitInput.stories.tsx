import type { Meta, StoryObj } from '@storybook/react-vite';
import { ConsoleFrameContext } from '../internal/consoleFrame.ts';
import { UnitField } from './UnitField.tsx';
import { UnitInput } from './UnitInput.tsx';

// A field has no loading state of its own: the panel that holds it carries the setting's loading and saving.
const meta = {
  title: 'Controls/UnitInput',
  component: UnitInput,
  args: { label: 'Seat hold', unit: 'minutes', min: 5, max: 240, initialValue: 20, onChange: () => undefined },
  // As in the console's panel at the side of the screen: 440 px wide, its content 24 px in, the console's own looks.
  decorators: [(Story) => <ConsoleFrameContext value><div className="w-side-panel bg-raised px-6 py-5"><Story /></div></ConsoleFrameContext>],
} satisfies Meta<typeof UnitInput>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

/** Nothing typed yet, with a line on what it is for. */
export const Empty: Story = { args: { initialValue: null, hint: 'How long a called seat waits' } };

/** Refused: outside its range, which it says. */
export const OutOfRange: Story = { args: { initialValue: 300 } };

/** One of a unit takes its singular. */
export const One: Story = { args: { label: 'Call time', unit: 'hours', min: 1, max: 12, initialValue: 1 } };

/** Bonus keeps its capital after a number. */
export const Bonus: Story = { args: { label: 'Bonus added by hand', unit: 'bonus', min: 50, max: 25000, initialValue: 5000 } };

export const LongText: Story = { args: { label: 'How long a called seat waits for the member before it goes to the next on the list', unit: 'seconds', initialValue: 120 } };

/** At a desk the field is 36 px, as every console control. */
export const AtADesk: Story = { tags: ['viewport-console'] };

const kept = () => undefined;

/** A character it does not take stays and is refused with why (#1001): "1.5" in a whole-number field. */
export const NotAWholeNumber: Story = { render: () => <UnitField label="Seat hold" unit="minutes" typed="1.5" hint="Between 5 and 240 minutes." onTyped={kept} /> };

/** A setting's percentage: % after it, its limits as the hint. */
export const Percent: Story = { render: () => <UnitField label="Rake" form="percent" typed="5.25" hint="Between 0% and 10%. Up to two decimals." onTyped={kept} /> };

/** A setting's money: ₹ before it, grouped as the limits show it. */
export const Rupees: Story = { render: () => <UnitField label="Cap" form="rupees" typed="3,000" hint="Between ₹50 and ₹10,000. In whole ₹50 chips." onTyped={kept} /> };

/** A third decimal is refused with why, in place of the hint. */
export const ThreeDecimals: Story = { render: () => <UnitField label="Rake" form="percent" typed="5.255" hint="Between 0% and 10%. Up to two decimals." onTyped={kept} /> };
