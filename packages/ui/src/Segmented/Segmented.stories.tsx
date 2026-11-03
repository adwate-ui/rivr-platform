import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';
import { Segmented } from './Segmented.tsx';

const VIEWS = [{ value: 'summary', label: 'Summary' }, { value: 'seats', label: 'Seats' }];

// One option is always chosen, so there is no loading, empty or error state of its own: the screen around it says those.
const meta = {
  title: 'Controls/Segmented',
  component: Segmented,
  tags: ['viewport-console'],
  args: { label: 'View', options: VIEWS, value: 'summary', onChange: () => undefined },
} satisfies Meta<typeof Segmented>;

export default meta;
type Story = StoryObj<typeof meta>;

/** The floor's Summary or Seats, 36 px at a desk. */
export const Default: Story = {};

/** Inside a row or a tile: 32 px at a desk. */
export const Small: Story = {
  args: { label: 'Density', size: 'small', value: 'compact', options: [{ value: 'comfortable', label: 'Comfortable' }, { value: 'compact', label: 'Compact' }] },
};

export const FourOptions: Story = {
  args: {
    label: 'Period', value: 'week',
    options: [{ value: 'tonight', label: 'Tonight' }, { value: 'week', label: 'Week' }, { value: 'month', label: 'Month' }, { value: 'year', label: 'Year' }],
  },
};

export const LongText: Story = {
  args: {
    label: 'Show', value: 'waiting',
    options: [{ value: 'waiting', label: 'Waiting for a seat tonight' }, { value: 'seated', label: 'Seated at a table' }, { value: 'left', label: 'Left the club' }],
  },
};

/** Below 1180 px each option is a 44 px touch target. */
export const OnAPortraitTablet: Story = { tags: ['!viewport-console', 'viewport-portrait'] };

export const Interactive: Story = {
  render: function Render() {
    const [view, setView] = useState('summary');
    return <Segmented label="View" options={VIEWS} value={view} onChange={setView} />;
  },
};
