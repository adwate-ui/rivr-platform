import type { Meta, StoryObj } from '@storybook/react-vite';
import { ToastProvider } from '../Toast/Toast.tsx';
import { OpenInBrowser } from './OpenInBrowser.tsx';

const meta = {
  title: 'Layout/OpenInBrowser',
  component: OpenInBrowser,
  tags: ['viewport-phone'],
  parameters: { layout: 'fullscreen' },
  decorators: [(Story) => <ToastProvider place="player"><Story /></ToastProvider>],
  args: {
    browser: { app: 'instagram', platform: 'iphone' },
    url: 'https://app.rivr.test/sign-in',
    why: 'Sign in there, so you stay signed in.',
    onContinue: () => undefined,
  },
} satisfies Meta<typeof OpenInBrowser>;

export default meta;
type Story = StoryObj<typeof meta>;

// No loading, empty or error story: the screen has none of those states, and the app is English only.

/** Sign-in inside Instagram's browser on an iPhone. */
export const Default: Story = {};

/** On Android, a link that opens Chrome itself comes first. */
export const Android: Story = {
  args: { browser: { app: 'instagram', platform: 'android' } },
};

/** The selfie step, when Instagram's browser refuses the camera (#1050). */
export const CameraRefused: Story = {
  args: { url: 'https://app.rivr.test/kyc', why: 'Instagram\'s browser can\'t use your camera. Take your selfie there.' },
};

/** Facebook's browser on a phone that is neither, with a reason long enough to wrap. */
export const LongText: Story = {
  args: {
    browser: { app: 'facebook', platform: 'other' },
    why: 'Facebook\'s browser can\'t use your camera, and anything you do here stays in Facebook. Take your selfie in your own browser, where you stay signed in.',
  },
};
