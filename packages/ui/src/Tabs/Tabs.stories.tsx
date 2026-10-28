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
