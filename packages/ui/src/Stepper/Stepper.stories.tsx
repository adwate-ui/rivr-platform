import type { Meta, StoryObj } from '@storybook/react-vite';
import { Stepper } from './Stepper.tsx';

const STEPS = ['Sent', 'Preparing', 'On its way', 'Delivered'];
const ID_CHECK = ['Member', 'Face', 'PAN card', 'Aadhaar front', 'Details'];

// The stepper draws where an order stands; the tracker around it carries any loading or error state.
const meta = {
  title: 'Data/Stepper',
  component: Stepper,
  args: { steps: STEPS, current: 2, label: 'Order' },
} satisfies Meta<typeof Stepper>;

export default meta;
type Story = StoryObj<typeof meta>;

export const OnItsWay: Story = {};

export const Sent: Story = { args: { current: 0 } };

export const Delivered: Story = { args: { current: 3 } };

/** The console's panel at the side of the screen: 440 px wide, its content 24 px in from each edge. */
const inPanel: Story['decorators'] = [(Story) => <div className="w-side-panel bg-raised px-6 py-5"><Story /></div>];

/** The ID check in person (redesign RD-15), at the panel's 440 px: two steps done, the third current, two to come, every name on one line. */
export const ProgressInAPanel: Story = { args: { look: 'progress', steps: ID_CHECK, current: 2, label: 'ID check' }, decorators: inPanel };

/** The first step: none done. */
export const ProgressAtTheStart: Story = { args: { look: 'progress', steps: ID_CHECK, current: 0, label: 'ID check' }, decorators: inPanel };

/** The last step, whose name ends at the panel's edge. */
export const ProgressAtTheEnd: Story = { args: { look: 'progress', steps: ID_CHECK, current: 4, label: 'ID check' }, decorators: inPanel };

/** The widest name current, so set bold: its column grows with it, and it stays clear of the next name. */
export const ProgressOnTheWidestName: Story = { args: { look: 'progress', steps: ID_CHECK, current: 3, label: 'ID check' }, decorators: inPanel };

/** On a phone (390 px) the five names still fit side by side. */
export const ProgressOnAPhone: Story = { args: { look: 'progress', steps: ID_CHECK, current: 2, label: 'ID check' }, tags: ['viewport-phone'] };

/** Names too long to fit side by side: only the current step is named, under bars of one width. */
export const ProgressWithLongNames: Story = {
  args: { look: 'progress', steps: ['Choose the member', 'Photograph the face', 'Photograph the PAN card', 'Photograph the Aadhaar front', 'Check the details'], current: 3, label: 'ID check' },
  decorators: inPanel,
};
