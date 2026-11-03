import type { Meta, StoryObj } from '@storybook/react-vite';
import { Button } from '../Button/Button.tsx';
import { ShortcutProvider, useShortcut } from './Shortcuts.tsx';

/** The Live floor's one gold action with its key: S seats a player, and the tooltip says so. */
function SeatAction({ label = 'Seat a player' }: { label?: string }) {
  const shortcut = useShortcut({ key: 's', label, onPress: () => undefined });
  return <Button variant="primary" size="compact" shortcut={shortcut}>{label}</Button>;
}

// A registry of keys has no look, loading, empty or error state of its own: the button shows what it offers.
const meta = {
  title: 'Controls/Shortcuts',
  component: ShortcutProvider,
  tags: ['viewport-console'],
  args: { children: <SeatAction /> },
} satisfies Meta<typeof ShortcutProvider>;

export default meta;
type Story = StoryObj<typeof meta>;

/** A button whose tooltip names its key, "Seat a player (S)". */
export const Default: Story = {};

/** A long label keeps its key at the end of the tooltip. */
export const LongText: Story = { args: { children: <SeatAction label="Seat the next player waiting for the first open seat" /> } };
