import type { Meta, StoryObj } from '@storybook/react-vite';
import { useEffect } from 'react';
import { OfflineBanner, type OfflineBannerProps } from './OfflineBanner.tsx';

function setOnline(online: boolean) {
  Object.defineProperty(navigator, 'onLine', { value: online, configurable: true });
  window.dispatchEvent(new Event(online ? 'online' : 'offline'));
}

/** Makes the story's window report offline, as a phone with no connection does, and online again after. */
function Offline(props: OfflineBannerProps) {
  useEffect(() => {
    setOnline(false);
    return () => setOnline(true);
  }, []);
  return <OfflineBanner {...props} />;
}

// Offline it shows; online it shows only an online message, which the dealer tablet passes while it
// sends what it held. There is no loading, empty or error story.
const meta = {
  title: 'Feedback/OfflineBanner',
  component: OfflineBanner,
} satisfies Meta<typeof OfflineBanner>;

export default meta;
type Story = StoryObj<typeof meta>;

export const WhileOffline: Story = { render: () => <Offline /> };

/** The dealer tablet holding hands while offline (#43). */
export const TabletQueue: Story = { render: () => <Offline message="Offline. 3 hands queued." onlineMessage="Sending 3 hands." /> };

/** Back online, sending what it held. */
export const Sending: Story = { args: { message: 'Offline. 3 hands queued.', onlineMessage: 'Sending 3 hands.' } };
