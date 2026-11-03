import type { Meta, StoryObj } from '@storybook/react-vite';
import { Button } from '../Button/Button.tsx';
import { Input } from '../Input/Input.tsx';
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

/** The console's steps (console v3): each a raised card with its action, the next one's disabled until its turn. */
export const Cards: Story = {
  args: {
    look: 'cards',
    label: 'Practice reset',
    steps: [
      { title: 'Switch to the practice venue', detail: 'You are in the practice venue.', state: 'done' },
      {
        title: 'Reset the practice venue', detail: 'Clears tonight in the practice venue, then reloads its seed.', state: 'current',
        content: <Input label="Type the venue’s name" />,
      },
      {
        title: 'Purge', detail: 'Asks for the venue’s name.', state: 'next',
        action: <Button variant="danger" size="compact" isDisabled>Purge venue</Button>,
      },
    ],
  },
  tags: ['viewport-console'],
};
