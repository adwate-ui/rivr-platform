import type { Meta, StoryObj } from '@storybook/react-vite';
import { Button } from '../Button/Button.tsx';
import { ShortcutProvider, useShortcut } from './Shortcuts.tsx';

/** The Live floor's one gold action with its key: S seats a player, and the tooltip says so. */
function SeatAction() {
  const shortcut = useShortcut({ key: 's', label: 'Seat a player', onPress: () => undefined });
  return <Button variant="primary" size="compact" shortcut={shortcut}>Seat a player</Button>;
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
