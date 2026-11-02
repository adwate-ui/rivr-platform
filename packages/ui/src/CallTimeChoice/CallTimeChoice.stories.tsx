import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, userEvent, within } from 'storybook/test';
import { CallTimeChoice } from './CallTimeChoice.tsx';

// Fixed choices, with no loading, empty or error state of its own: the form it sits in has those.
const meta = {
  title: 'Floor/CallTimeChoice',
  component: CallTimeChoice,
  tags: ['viewport-console'],
  args: { choices: [180, 240, 300], initial: 180, onChange: () => undefined },
} satisfies Meta<typeof CallTimeChoice>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Three hours, the club's usual. */
export const Default: Story = {};

/** Custom, with the minutes asked for. */
export const Custom: Story = {
  play: async ({ canvasElement }) => {
    await userEvent.click(within(canvasElement).getByRole('button', { name: 'Custom' }));
    await expect(within(canvasElement).getByRole('textbox', { name: /^Minutes/ })).toBeVisible();
  },
};

/** A call time set before that is none of the usual: Custom, filled in. */
export const Unusual: Story = { args: { initial: 150 } };
