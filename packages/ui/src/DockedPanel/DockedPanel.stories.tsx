import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';
import { Box } from '../Box/Box.tsx';
import { RequestItem } from '../RequestItem/RequestItem.tsx';
import { Skeleton } from '../Skeleton/Skeleton.tsx';
import { Text } from '../Text/Text.tsx';
import { DockedPanel, type DockedPanelProps } from './DockedPanel.tsx';

const noop = () => undefined;

const REQUESTS = (
  <>
    <RequestItem kind="Join request" age="4 min" title="Ritika Bhalla" detail="Table 1 waitlist"
      primary={{ label: 'Approve', onClick: noop }} secondary={{ label: 'Decline', onClick: noop }} />
    <RequestItem kind="Top-up" age="4 min" isLate title="Vidya Chadha" detail="Table 1, seat 2" primary={{ label: 'Start', onClick: noop }} />
  </>
);

/** The panel as the Live floor holds it: open or folded by its own toggle. */
function Docked(props: Omit<DockedPanelProps, 'onToggle'>) {
  const [isOpen, setOpen] = useState(props.isOpen);
  return (
    <Box surface="surface">
      <DockedPanel {...props} isOpen={isOpen} onToggle={() => setOpen((open) => !open)} />
    </Box>
  );
}

const meta = {
  title: 'Floor/DockedPanel',
  component: Docked,
  args: { title: 'Requests', count: 2, isOpen: true, panel: REQUESTS, children: <Text>Live floor</Text> },
  parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof Docked>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

/** Folded to its strip: the count in gold while something waits, the name read down the strip. */
export const Folded: Story = { args: { isOpen: false } };

/** Folded with nothing waiting: the count is faint. */
export const Empty: Story = { args: { isOpen: false, count: 0, panel: <Text tone="muted">All clear.</Text> } };

export const Loading: Story = { args: { count: 0, panel: <Skeleton look="rows" rows={3} /> } };

/** A panel's own error is the screen's to show; here, a long name and a long list. */
export const LongText: Story = {
  args: { title: 'Requests waiting on the floor tonight', count: 128, panel: <>{REQUESTS}{REQUESTS}{REQUESTS}</> },
};
