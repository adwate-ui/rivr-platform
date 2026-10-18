import type { Meta, StoryObj } from '@storybook/react-vite';
import { InstallOffer } from './InstallOffer.tsx';

// The offer shows only when it can be acted on, so it has no loading, empty or error state.
const meta = {
  title: 'Feedback/InstallOffer',
  component: InstallOffer,
  args: { kind: 'prompt', onInstall: () => undefined, onDismiss: () => undefined },
} satisfies Meta<typeof InstallOffer>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Prompt: Story = {};

/** An iPhone, where only Safari can add the app: the offer says how, with no Install button. */
export const Iphone: Story = { args: { kind: 'ios' } };
