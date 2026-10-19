import type { Meta, StoryObj } from '@storybook/react-vite';
import { Button } from '../Button/Button.tsx';
import { FloorRow } from './FloorRow.tsx';

const meta = {
  title: 'Data/FloorRow',
  component: FloorRow,
  args: { name: 'Table 3', smallBlind: 10_000n, bigBlind: 20_000n, detail: '3 waiting', action: <Button variant="secondary">Join</Button> },
} satisfies Meta<typeof FloorRow>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

/** No one waits for the game. */
export const Empty: Story = { args: { name: 'Table 1', smallBlind: 5_000n, bigBlind: 10_000n, detail: 'No wait' } };

/** A table that is not running tonight: no action. */
export const Closed: Story = { args: { name: 'Table 4', detail: 'Closed', action: undefined, isMuted: true } };

/** The member is already on the game's list. */
export const OnTheList: Story = { args: { detail: '4 waiting · You are 4th', action: undefined } };

export const LongText: Story = {
  args: { name: 'Private Room with a much longer name than any table has', detail: '12 waiting, and a straddle of ₹500 on every hand' },
};
