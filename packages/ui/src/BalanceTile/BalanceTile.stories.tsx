import type { Meta, StoryObj } from '@storybook/react-vite';
import { Grid } from '../Grid/Grid.tsx';
import { BalanceTile } from './BalanceTile.tsx';

// A tile shows one balance; the Rewards screen around it carries the loading, empty and error states.
const meta = {
  title: 'Data/BalanceTile',
  component: BalanceTile,
  args: { icon: 'star', figure: '3,250', label: 'Points', line: 'Spend on rewards.' },
} satisfies Meta<typeof BalanceTile>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Points: Story = {};

export const BonusChips: Story = {
  args: { icon: 'chip', figure: '1,500', label: 'Bonus chips', line: 'Use with your buy-in. Never expire.', tone: 'money', onOpen: () => undefined, 'aria-expanded': false },
};

/** As Rewards shows them: points and bonus chips side by side, each with its line. */
export const Pair: Story = {
  render: () => (
    <Grid columns={2} gap={3}>
      <BalanceTile icon="star" figure="3,250" label="Points" line="Spend on rewards." onOpen={() => undefined} />
      <BalanceTile icon="chip" figure="1,500" label="Bonus chips" line="Use with your buy-in. Never expire." tone="money" onOpen={() => undefined} />
    </Grid>
  ),
};

export const LongText: Story = { args: { figure: '12,34,56,789', line: 'Spend on rewards in the catalogue, at the host desk or the bar.' } };
