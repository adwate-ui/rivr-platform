import type { FormEvent, ReactNode } from 'react';
import { Button } from '../Button/Button.tsx';
import { Heading, type SerifSize } from '../Heading/Heading.tsx';
import { cx } from '../internal/classes.ts';
import { Text } from '../Text/Text.tsx';

export interface StepScreenProps {
  /** The step's content: a field, a lockup, a document photo. */
  children: ReactNode;
  /** At the bottom of the screen: the step's one action, with a field above it when the field belongs there. */
  footer: ReactNode;
  /** The step's heading, a noun ("Code"). Leave it out when the content names the screen itself. */
  title?: string | undefined;
  /** A way to the previous step, top left. */
  back?: { label: string; onBack: () => void } | undefined;
  /**
   * The player redesign's step (decision 0320): the title in the display face at `serifSize` (36 unless given), a gold
   * `eyebrow` above it and a muted `subtitle` under it, and a chevron on Back. Otherwise the text face's step title.
   */
  look?: { serifSize?: SerifSize; eyebrow?: string | undefined; subtitle?: string | undefined } | undefined;
  /** `top` sets the content under the title; `center` sets it in the middle of the screen. */
  align?: 'top' | 'center';
  /**
   * Makes the step a form: Enter in a field, the keyboard's Go key or a `type="submit"` button
   * calls this, and the page never reloads. React Hook Form's `handleSubmit(onValid)` fits as is.
   */
  onSubmit?: ((event: FormEvent<HTMLFormElement>) => void | Promise<void>) | undefined;
}

const ALIGN = { top: 'pt-6', center: 'items-center justify-center' } as const;

const BACK_CHEVRON = { icon: 'chevronLeft' } as const;

/** The step's title: the text face's, or the redesign's in the display face with its eyebrow and subtitle. */
function StepTitle({ title, look }: { title: string; look: StepScreenProps['look'] }) {
  if (look === undefined) return <Heading level={1} variant="step">{title}</Heading>;
  return (
    <div className="flex flex-col gap-2">
      {look.eyebrow ? <Text variant="eyebrow" tone="accent">{look.eyebrow}</Text> : null}
      <Heading level={1} variant="serif" serifSize={look.serifSize ?? 36}>{title}</Heading>
      {look.subtitle ? <Text tone="muted">{look.subtitle}</Text> : null}
    </div>
  );
}

/**
 * One step of a flow on a 390 px phone, outside the app's tabs: sign-in, then the KYC steps.
 * Back, the heading and the content, and the action at the bottom of the screen (design
 * prompt, "Sign-in and KYC"). The action stays inside `main`: it is the step's purpose, not
 * page furniture, so a screen reader jumping to main finds the field and the button. From 768 px,
 * on a tablet or a computer, the step is a panel in the middle of the screen, its action under its
 * content, not the phone's column stretched to the screen's foot (S-01).
 */
export function StepScreen({ children, footer, title, back, align = 'top', onSubmit, look }: StepScreenProps) {
  const step = (
    <>
      <div className={cx('flex flex-1 flex-col gap-6', ALIGN[align])}>
        {title ? <StepTitle title={title} look={look} /> : null}
        {children}
      </div>
      <div className="flex flex-col gap-6 pt-6">{footer}</div>
    </>
  );
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void onSubmit?.(event);
  };
  return (
    <div className="flex min-h-dvh w-full flex-col bg-surface text-content medium:items-center medium:justify-center medium:px-6 medium:py-12">
      <div className="mx-auto flex w-full max-w-phone flex-1 flex-col px-6 pt-4 pb-8 medium:flex-none medium:rounded-lg medium:border medium:border-hairline medium:bg-raised medium:px-10 medium:py-10">
        {back ? (
          <header className="-ml-3 self-start">
            <Button variant="text" onClick={back.onBack} {...(look ? BACK_CHEVRON : {})}>
              {back.label}
            </Button>
          </header>
        ) : null}
        <main className="flex flex-1 flex-col">
          {onSubmit ? (
            // Fields are checked by the form's schema, so the browser's own validation stays off.
            <form noValidate className="flex flex-1 flex-col" onSubmit={submit}>
              {step}
            </form>
          ) : (
            step
          )}
        </main>
      </div>
    </div>
  );
}
