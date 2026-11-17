import { tokens } from '@rivr/tokens';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { ProfileCard } from './ProfileCard.tsx';

// A plain portrait drawn in place, as ProfileMark's stories have it, so the screenshot never depends on a network image.
const { greenBlack, cream } = tokens.color;
const PORTRAIT =
  'data:image/svg+xml,' +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 30 40"><rect width="30" height="40" fill="${greenBlack}"/>` +
      `<circle cx="15" cy="17" r="7" fill="${cream}"/><rect x="5" y="27" width="20" height="13" rx="6" fill="${cream}"/></svg>`,
  );

// The card shows what it is given: until the record comes, an empty name and no lines are its loading state.
const meta = {
  title: 'Data/ProfileCard',
  component: ProfileCard,
  args: { initial: 'M', name: 'Meera Iyer', headingId: 'profile-name', details: ['Founders’ Circle · +91 90000 00901', 'Member number 1024'] },
  // The player app's card: drawn at a phone's width, as BalanceTile's hero is.
  tags: ['viewport-phone'],
} satisfies Meta<typeof ProfileCard>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const WithPhoto: Story = { args: { photo: PORTRAIT } };

export const Loading: Story = { args: { initial: '', name: '', details: [] } };

export const LongName: Story = {
  args: { initial: 'A', name: 'Aishwarya Venkataraghavan Subramaniam', details: ['Founders’ Circle · +91 90000 00901', 'Member number 10240'] },
};
