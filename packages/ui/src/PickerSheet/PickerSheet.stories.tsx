import type { Meta, StoryObj } from '@storybook/react-vite';
import { PickerSheet } from './PickerSheet.tsx';

const OCCUPATIONS = ['Salaried', 'Business owner', 'Self-employed professional', 'Student', 'Homemaker', 'Retired', 'Prefer not to say']
  .map((label) => ({ value: label, label }));

// A picker holds a choice; it has no loading or empty state of its own. Its error is the field's.
const meta = {
  title: 'Controls/PickerSheet',
  component: PickerSheet,
  args: { label: 'Occupation', options: OCCUPATIONS, selected: [], onChange: () => undefined, placeholder: 'Select' },
} satisfies Meta<typeof PickerSheet>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Empty: Story = {};

export const Picked: Story = { args: { selected: ['Business owner'] } };

export const Many: Story = {
  args: {
    label: 'Games you play', mode: 'many', placeholder: 'Select any',
    options: ["Hold'em", 'PLO', 'Bomb pots', 'ROE'].map((label) => ({ value: label, label })), selected: ["Hold'em", 'PLO'],
  },
};

export const WithError: Story = { args: { error: 'Select your occupation.' } };

export const LongText: Story = { args: { selected: ['Self-employed professional'], label: 'What you do for a living, as on your PAN' } };
