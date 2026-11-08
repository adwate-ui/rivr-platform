import type { Meta, StoryObj } from '@storybook/react-vite';
import { Inline } from '../Inline/Inline.tsx';
import { DietMark } from './DietMark.tsx';

// A mark has no data of its own: nothing to load, no empty or failed state. The app is in English only.
const meta = { title: 'Data/DietMark', component: DietMark, args: { diet: 'veg' } } satisfies Meta<typeof DietMark>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Veg: Story = {};

export const Egg: Story = { args: { diet: 'egg' } };

export const NonVeg: Story = { args: { diet: 'non_veg' } };

/** The three side by side, as a menu has them. */
export const AllThree: Story = {
  render: () => (
    <Inline gap={3} align="center">
      <DietMark diet="veg" />
      <DietMark diet="egg" />
      <DietMark diet="non_veg" />
    </Inline>
  ),
};
