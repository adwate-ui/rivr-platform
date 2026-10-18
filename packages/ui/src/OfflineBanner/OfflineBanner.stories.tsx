import type { Meta, StoryObj } from '@storybook/react-vite';
import { useEffect } from 'react';
import { OfflineBanner } from './OfflineBanner.tsx';

/** Makes the story's window report offline, as a phone with no connection does. */
function Offline() {
  useEffect(() => {
    Object.defineProperty(navigator, 'onLine', { value: false, configurable: true });
    window.dispatchEvent(new Event('offline'));
  }, []);
  return <OfflineBanner />;
}

// The banner has one state that shows: offline. Online it renders nothing, so there is no loading,
// empty or error story.
const meta = {
  title: 'Feedback/OfflineBanner',
  component: OfflineBanner,
} satisfies Meta<typeof OfflineBanner>;

export default meta;
type Story = StoryObj<typeof meta>;

export const WhileOffline: Story = { render: () => <Offline /> };
