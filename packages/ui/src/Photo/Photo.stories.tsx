import { tokens } from '@rivr/tokens';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { Photo } from './Photo.tsx';

// A plain portrait drawn in place, in the palette, so the screenshot never depends on a network image.
const { greenBlack, cream } = tokens.color;
const PORTRAIT =
  'data:image/svg+xml,' +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 30 40"><rect width="30" height="40" fill="${greenBlack}"/>` +
      `<circle cx="15" cy="15" r="7" fill="${cream}"/><rect x="5" y="25" width="20" height="15" rx="6" fill="${cream}"/></svg>`,
  );

const meta = {
  title: 'Media/Photo',
  component: Photo,
  args: { alt: 'KYC photo of Kabir Sethi', src: PORTRAIT },
} satisfies Meta<typeof Photo>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Loading: Story = { args: { src: null, status: 'loading' } };

export const Missing: Story = { args: { src: null, status: 'missing' } };

export const WithError: Story = { args: { src: null, status: 'error' } };
