import type { Meta, StoryObj } from '@storybook/react-vite';
import { Button } from '../Button/Button.tsx';
import { CodeInput } from '../CodeInput/CodeInput.tsx';
import { Input } from '../Input/Input.tsx';
import { Text } from '../Text/Text.tsx';
import { Wordmark } from '../Wordmark/Wordmark.tsx';
import { StepScreen } from './StepScreen.tsx';

const back = { label: 'Back', onBack: () => undefined };

const codeField = (error?: string) => <CodeInput label="6-digit code" value="" onChange={() => undefined} error={error} />;

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

/** From 768 px: the step is a panel in the middle of the screen, its action under its content (S-01). */
export const OnAComputer: Story = { ...Centred, tags: ['!viewport-phone', 'viewport-console'] };

/** The player redesign's step (decision 0320): eyebrow, the title in the display face, a subtitle, and Back with a chevron. */
export const Redesign: Story = {
  args: {
    title: 'Verify your identity',
    look: { eyebrow: 'Step 2 of 2', subtitle: 'Required before you play.' },
    back: { label: 'Back', onBack: () => undefined },
    children: null,
    footer: <Button variant="primary" size="tall" fullWidth>Take a selfie</Button>,
  },
};

/** Sign-up's top bar: the chevron back, a segment a step and "1 of 2", with the footer ruled (decision 0320). */
export const SignUpProgress: Story = {
  args: {
    title: 'About you',
    look: { serifSize: 40, subtitle: 'Signing up with +91 90000 00901', progress: { step: 1, of: 2, label: '1 of 2' }, isFooterRuled: true },
    back: { label: 'Back', onBack: () => undefined },
    children: null,
    footer: <Button variant="primary" size="tall" fullWidth>Continue</Button>,
  },
};
