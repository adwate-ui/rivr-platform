import type { Meta, StoryObj } from '@storybook/react-vite';
import { TextArea } from './TextArea.tsx';

const meta = {
  title: 'Controls/TextArea',
  component: TextArea,
  args: { label: 'Text', hint: 'One step a line, numbered.', rows: 6 },
} satisfies Meta<typeof TextArea>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Filled: Story = {
  args: {
    defaultValue:
      '1. Open the cage\'s shift on the console and count the float by denomination.\n' +
      '2. Sell chips only to a member whose identity check is complete.\n' +
      '3. Confirm a UPI deposit only once its amount and UTR are found in the bank.',
  },
};

export const Empty: Story = { args: { hint: undefined, placeholder: '1. The first step' } };

export const WithError: Story = { args: { defaultValue: '', error: 'Write the text of this version.' } };

export const Disabled: Story = { args: { disabled: true, defaultValue: '1. Count the float.' } };

export const LongText: Story = {
  args: {
    label: 'The text of this version, as staff will read and acknowledge it on the console',
    hint: 'Write one step a line, numbered, in the order staff follow them. Staff whose role must acknowledge it see it at once on its day.',
    error: 'The text is longer than 20,000 characters. Split the procedure into two SOPs.',
    defaultValue: Array.from({ length: 12 }, (_, step) => `${step + 1}. A step of the procedure that runs long enough to wrap onto a second line at this width.`).join('\n'),
  },
};
