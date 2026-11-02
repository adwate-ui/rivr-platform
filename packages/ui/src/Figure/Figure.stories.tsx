import type { Meta, StoryObj } from '@storybook/react-vite';
import { Figure } from './Figure.tsx';

// A figure shows a value it is given; the screen around it carries any loading or error state.
const meta = {
  title: 'Type/Figure',
  component: Figure,
  args: { children: '2:41:08', size: 'timer', role: 'timer', 'aria-label': 'Call time left 2h 41m' },
} satisfies Meta<typeof Figure>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Timer: Story = {};

export const Hold: Story = { args: { children: '19:42', size: 'hold' } };

export const Place: Story = { args: { children: '1', size: 'place', role: undefined, 'aria-label': undefined } };

export const Points: Story = { args: { children: '3,250', size: 'display', tone: 'money', role: undefined, 'aria-label': undefined } };
