import type { Meta, StoryObj } from '@storybook/react-vite';
import { Button } from '../Button/Button.tsx';
import { Inline } from '../Inline/Inline.tsx';
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

/** A game whose name carries its stakes, as a member's waitlist place shows it: the stakes are not shown again (P-05). */
export const WithoutStakes: Story = { args: { name: 'NLH 100/200', smallBlind: undefined, bigBlind: undefined, detail: '2nd on the list, since 21:40' } };

/** Leave asking to be sure: the wider action goes under the name rather than squeezing it (P-04). */
export const ActionWraps: Story = {
  tags: ['viewport-phone'],
  args: {
    name: 'NLH 100/200', smallBlind: undefined, bigBlind: undefined, detail: '2nd on the list, since 21:40',
    action: (
      <Inline gap={2}>
        <Button variant="text">Step away</Button>
        <Button variant="danger">Yes, leave</Button>
        <Button variant="text">Cancel</Button>
      </Inline>
    ),
  },
};
