import type { Meta, StoryObj } from '@storybook/react-vite';
import { ChoiceSheet } from './ChoiceSheet.tsx';

const BREAKS = [
  { value: '1', label: '24 hours', detail: 'Until Wed 17 Feb, 00:10' },
  { value: '7', label: '7 days', detail: 'Until Tue 23 Feb, 00:10' },
  { value: '30', label: '30 days', detail: 'Until Thu 18 Mar, 00:10' },
];

// The sheet asks one question; it has no loading, empty or error state of its own. Saving dims the
// choices; the screen behind says what went wrong.
const meta = {
  title: 'Controls/ChoiceSheet',
  component: ChoiceSheet,
  parameters: { layout: 'fullscreen' },
  args: {
    isOpen: true,
    title: 'Take a break',
    description: 'Waitlists and buy-ins close for the period you choose. It cannot be shortened.',
    choices: BREAKS,
    onChoose: () => undefined,
    onCancel: () => undefined,
  },
} satisfies Meta<typeof ChoiceSheet>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Saving: Story = { args: { isBusy: true } };

export const WithoutDetails: Story = { args: { choices: BREAKS.map(({ value, label }) => ({ value, label })) } };

export const LongText: Story = {
  args: {
    title: 'Take a break from every table, tournament and buy-in at the club',
    description: 'Waitlists and buy-ins close for the period you choose. It cannot be shortened, by you or by the floor, so pick the shortest break that helps.',
    choices: [...BREAKS, { value: '90', label: 'Ninety days, the longest break the app offers', detail: 'Until Mon 17 May, 00:10' }],
  },
};
