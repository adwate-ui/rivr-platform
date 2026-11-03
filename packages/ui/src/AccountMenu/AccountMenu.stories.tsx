import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, userEvent, within } from 'storybook/test';
import { Segmented } from '../Segmented/Segmented.tsx';
import { Switch } from '../Switch/Switch.tsx';
import { AccountMenu, AccountMenuRow } from './AccountMenu.tsx';

const DENSITY = [{ value: 'comfortable', label: 'Comfortable' }, { value: 'compact', label: 'Compact' }] as const;

const SHORTCUTS = [
  { keys: '/', label: 'Search' }, { keys: 'A', label: 'Approve the oldest request' }, { keys: 'D', label: 'Decline the oldest request' },
  { keys: 'S', label: 'Seat a player' }, { keys: 'Esc', label: 'Close' },
];

const settings = (
  <>
    <AccountMenuRow label="Density">
      <Segmented label="Density" size="small" options={DENSITY} value="comfortable" onChange={() => undefined} />
    </AccountMenuRow>
    <Switch label="Practice venue" isOn={false} onChange={() => undefined} />
  </>
);

/** Opens the menu, as a press on the initials does, so the story shows it. */
async function open({ canvasElement }: { canvasElement: HTMLElement }) {
  await userEvent.click(within(canvasElement).getByRole('button', { name: /^Vikram|^Ritika/ }));
  await expect(within(canvasElement).getByRole('group')).toBeInTheDocument();
}

// A menu of the staff member's own settings has no loading, empty or error state: the header shows it once they are known.
const meta = {
  title: 'Shells/AccountMenu',
  component: AccountMenu,
  tags: ['viewport-console'],
  args: { name: 'Vikram Rao', detail: 'Super admin · RIVR Gurugram', shortcuts: SHORTCUTS, signOut: { label: 'Sign out', onPress: () => undefined }, children: settings },
  // At the end of a header line, as in the console, so the panel opens below and lines up with the button's end.
  decorators: [(Story) => <div className="flex h-palette items-start justify-end p-4"><Story /></div>],
} satisfies Meta<typeof AccountMenu>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Shut: the round button with the initials. */
export const Default: Story = {};

/** Open: name, role and venue, the density and the practice venue, the shortcuts, Sign out. */
export const Open: Story = { play: open };

/** Signing out: the line dims while it goes. */
export const SigningOut: Story = { args: { signOut: { label: 'Sign out', onPress: () => undefined, isPending: true } }, play: open };

/** A staff member with no settings to change and no shortcuts on the screen. */
export const Plain: Story = { args: { children: undefined, shortcuts: [] }, play: open };

export const LongText: Story = {
  args: { name: 'Ritika Venkataraman-Chakraborty', detail: 'Floor manager · RIVR Practice, the training venue' },
  play: open,
};
