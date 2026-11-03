import type { Meta, StoryObj } from '@storybook/react-vite';
import { Tabs } from './Tabs.tsx';

const meta = {
  title: 'Navigation/Tabs',
  component: Tabs,
  tags: ['viewport-console'],
  args: {
    label: 'Tournaments',
    current: 'list',
    tabs: [
      { id: 'list', label: 'Tournaments', href: '#list' },
      { id: 'templates', label: 'Templates', href: '#templates' },
      { id: 'structures', label: 'Structures', href: '#structures' },
    ],
  },
} satisfies Meta<typeof Tabs>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const LongText: Story = {
  args: {
    current: 'unclaimed',
    tabs: [
      { id: 'rake', label: "Tonight's rake by table and dealer", href: '#rake' },
      { id: 'mis', label: 'Monthly investor report', href: '#mis' },
      { id: 'unclaimed', label: 'Unclaimed balances', href: '#unclaimed' },
      { id: 'funnel', label: 'Growth funnel and channels', href: '#funnel' },
    ],
  },
};

/** On a phone the row scrolls sideways rather than wrapping. */
export const OnAPhone: Story = { ...LongText, tags: ['!viewport-console', 'viewport-phone'] };

/** On a tablet held upright the tabs keep to one row. */
export const OnAPortraitTablet: Story = { ...LongText, tags: ['!viewport-console', 'viewport-portrait'] };

/** The console's pills (console v3): no hairline, the part shown on a faint fill; 32 px at a desk. */
export const Pills: Story = {
  args: {
    look: 'pill', label: 'Waitlist', current: 'tables',
    tabs: [
      { id: 'tables', label: 'By table', href: '#tables' },
      { id: 'interest', label: 'Interest list', href: '#interest' },
      { id: 'tournament', label: 'Tournament interest', href: '#tournament' },
    ],
  },
};

export const PillsLongText: Story = { args: { ...LongText.args, look: 'pill' } };

/** Below 1180 px each pill is a 44 px touch target. */
export const PillsOnAPortraitTablet: Story = { ...Pills, tags: ['!viewport-console', 'viewport-portrait'] };
