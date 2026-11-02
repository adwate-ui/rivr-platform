import type { Meta, StoryObj } from '@storybook/react-vite';
import { StepList } from './StepList.tsx';

// A list of steps has no loading, empty or error state of its own: the screen around it has them.
const meta = {
  title: 'Navigation/StepList',
  component: StepList,
  args: {
    label: 'Identity check',
    steps: [
      { title: 'Selfie', detail: 'A photo of your face, taken now.', state: 'current' },
      { title: 'DigiLocker', detail: 'Your Aadhaar, its OTP and your consent.', state: 'next' },
      { title: 'Verified', detail: 'Book a seat.', state: 'next' },
    ],
  },
} satisfies Meta<typeof StepList>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Halfway: Story = {
  args: {
    steps: [
      { title: 'Selfie', state: 'done' },
      { title: 'DigiLocker', detail: 'Your Aadhaar, its OTP and your consent.', state: 'current' },
      { title: 'Verified', detail: 'Book a seat.', state: 'next' },
    ],
  },
};

export const AllDone: Story = {
  args: { steps: [{ title: 'Selfie', state: 'done' }, { title: 'DigiLocker', state: 'done' }, { title: 'Verified', state: 'done' }] },
};

export const LongText: Story = {
  args: {
    steps: [
      { title: 'A photo of your face, taken now, in good light and without a cap', state: 'done' },
      { title: 'DigiLocker', detail: 'Your Aadhaar number, then the six-digit code that comes to the mobile number linked to it, then allow RIVR to read your Aadhaar and PAN.', state: 'current' },
    ],
  },
};

/** The player redesign's identity steps, each between hairlines (decision 0320). */
export const Ruled: Story = { args: { look: 'ruled' } };
