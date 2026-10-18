import type { Meta, StoryObj } from '@storybook/react-vite';
import { Button } from '../Button/Button.tsx';
import { Input } from '../Input/Input.tsx';
import { Text } from '../Text/Text.tsx';
import { Wordmark } from '../Wordmark/Wordmark.tsx';
import { StepScreen } from './StepScreen.tsx';

const back = { label: 'Back', onBack: () => undefined };

const codeField = (error?: string) => (
  <Input
    label="Code"
    variant="code"
    inputMode="numeric"
    autoComplete="one-time-code"
    placeholder="6 digits"
    hint="Sent to +91 98110 42817"
    error={error}
  />
);

const meta = {
  title: 'Layout/StepScreen',
  component: StepScreen,
  tags: ['viewport-phone'],
  parameters: { layout: 'fullscreen' },
  args: {
    title: 'Code',
    back,
    children: codeField(),
    footer: (
      <Button variant="primary" fullWidth>
        Verify
      </Button>
    ),
  },
} satisfies Meta<typeof StepScreen>;

export default meta;
type Story = StoryObj<typeof meta>;

/** The code step of sign-in. */
export const Default: Story = {};

/** The first sign-in step: the lockup in the middle, the number and its action at the bottom. */
export const Centred: Story = {
  args: {
    title: undefined,
    back: undefined,
    align: 'center',
    children: <Wordmark size="lg" withTagline withMotto align="center" />,
    footer: (
      <>
        <Input label="Mobile number" type="tel" inputMode="tel" variant="line" prefix="+91" autoComplete="tel-national" />
        <Button variant="primary" fullWidth>
          Send code
        </Button>
      </>
    ),
  },
};

export const Loading: Story = {
  args: {
    footer: (
      <Button variant="primary" fullWidth isLoading>
        Verify
      </Button>
    ),
  },
};

export const Empty: Story = { args: { children: <Text tone="muted">Nothing to fill in on this step.</Text> } };

export const WithError: Story = { args: { children: codeField('Code wrong or expired. Check it, or request a new one.') } };

export const LongText: Story = {
  args: {
    title: 'Identity document from DigiLocker with masked Aadhaar',
    back: { label: 'Back to the mobile number', onBack: () => undefined },
  },
};
