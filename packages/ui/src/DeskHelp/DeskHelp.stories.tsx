import type { Decorator, Meta, StoryObj } from '@storybook/react-vite';
import { DeskHelp, DeskHelpProvider } from './DeskHelp.tsx';

/** The club's numbers, as the player app's AppRoot gives them. */
const withNumber: Decorator = (Story) => <DeskHelpProvider contact={{ phone: '+918796580435', whatsapp: '+918796580435' }}><Story /></DeskHelpProvider>;

// Two links and nothing to load: no loading or error state.
const meta = {
  title: 'Navigation/DeskHelp',
  component: DeskHelp,
} satisfies Meta<typeof DeskHelp>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = { decorators: [withNumber] };

/** On a phone the two share a line. */
export const OnAPhone: Story = { tags: ['viewport-phone'], decorators: [withNumber] };

/** Without a number, as on the console, it draws nothing. */
export const Empty: Story = {};
