import type { Meta, StoryObj } from '@storybook/react-vite';
import { Button } from '../Button/Button.tsx';
import { ReasonForm } from '../ReasonForm/ReasonForm.tsx';
import { PromptBar } from './PromptBar.tsx';

const actions = (
  <>
    <Button variant="secondary">Approve ₹10,000</Button>
    <Button variant="text">Reject</Button>
  </>
);

const meta = {
  title: 'Feedback/PromptBar',
  component: PromptBar,
  args: { message: 'High hand claim · Table 3, seat 4 · Straight flush · ₹10,000', actions },
} satisfies Meta<typeof PromptBar>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

/** Reject opened the reason form under the line. */
export const WithForm: Story = {
  args: {
    children: (
      <ReasonForm field={{ name: 'reason', value: '', onChange: () => undefined }} label="Why it is not approved"
        actions={[{ label: 'Reject the claim', onClick: () => undefined }]} onCancel={() => undefined} />
    ),
  },
};

export const LongText: Story = {
  args: {
    message: 'High hand claim · Private table of the season final, seat 9 · Four of a kind Queens · ₹25,000 · 3 more waiting',
    actions: (
      <>
        <Button variant="secondary">Approve ₹25,000</Button>
        <Button variant="text">Reject</Button>
        <Button variant="text">See all 4</Button>
      </>
    ),
  },
};
