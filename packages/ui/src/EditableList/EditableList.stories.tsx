import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, screen, userEvent } from 'storybook/test';
import { ConsoleFrameContext } from '../internal/consoleFrame.ts';
import { EditableList } from './EditableList.tsx';

// A list has no loading state of its own: the panel that holds it carries the setting's loading and saving.
const meta = {
  title: 'Controls/EditableList',
  component: EditableList,
  args: { label: 'Add time choices', entryLabel: 'Choice', addLabel: 'Add a choice', unit: 'minutes', min: 5, max: 480, initialValues: [30, 60, 120], onChange: () => undefined },
  // As in the console's panel at the side of the screen: 440 px wide, its content 24 px in, the console's own looks.
  decorators: [(Story) => <ConsoleFrameContext value><div className="w-side-panel max-w-full bg-raised px-6 py-5"><Story /></div></ConsoleFrameContext>],
} satisfies Meta<typeof EditableList>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

/** No entries yet: one line, and the way to add the first. */
export const Empty: Story = { args: { initialValues: [] } };

/** Refused entries, each with why under it: one that repeats an earlier one, one outside the range, and a new one left blank. */
export const Refused: Story = {
  args: { initialValues: [30, 30, 600] },
  play: async () => {
    await userEvent.click(screen.getByRole('button', { name: 'Add a choice' }));
    await expect(screen.getByRole('textbox', { name: 'Choice 4' })).toHaveFocus();
  },
};

export const LongText: Story = { args: { entryLabel: 'A length of extra time a seated member can ask the floor for', addLabel: 'Add another length of extra time' } };

/** At a desk the fields and Remove are 36 px, level at their foot. */
export const AtADesk: Story = { tags: ['viewport-console'] };

/** Full: with a most of three, Add is off and the list says so. */
export const Full: Story = { args: { maxEntries: 3 } };

/** On a phone the panel is the screen's width. */
export const OnAPhone: Story = { tags: ['viewport-phone'] };
