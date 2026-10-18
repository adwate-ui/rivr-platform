import type { FormEvent, ReactNode } from 'react';
import { Button } from '../Button/Button.tsx';
import { Heading } from '../Heading/Heading.tsx';
import { cx } from '../internal/classes.ts';

export interface StepScreenProps {
  /** The step's content: a field, a lockup, a document photo. */
  children: ReactNode;
  /** At the bottom of the screen: the step's one action, with a field above it when the field belongs there. */
  footer: ReactNode;
  /** The step's heading, a noun ("Code"). Leave it out when the content names the screen itself. */
  title?: string | undefined;
  /** A way to the previous step, top left. */
  back?: { label: string; onBack: () => void } | undefined;
  /** `top` sets the content under the title; `center` sets it in the middle of the screen. */
  align?: 'top' | 'center';
  /**
   * Makes the step a form: Enter in a field, the keyboard's Go key or a `type="submit"` button
   * calls this, and the page never reloads. React Hook Form's `handleSubmit(onValid)` fits as is.
   */
  onSubmit?: ((event: FormEvent<HTMLFormElement>) => void | Promise<void>) | undefined;
}

const ALIGN = { top: 'pt-6', center: 'items-center justify-center' } as const;

/**
 * One step of a flow on a 390 px phone, outside the app's tabs: sign-in, then the KYC steps.
 * Back, the heading and the content, and the action at the bottom of the screen (design
 * prompt, "Sign-in and KYC"). The action stays inside `main`: it is the step's purpose, not
 * page furniture, so a screen reader jumping to main finds the field and the button.
 */
export function StepScreen({ children, footer, title, back, align = 'top', onSubmit }: StepScreenProps) {
  const step = (
    <>
      <div className={cx('flex flex-1 flex-col gap-6', ALIGN[align])}>
        {title ? <Heading level={1}>{title}</Heading> : null}
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
    <div className="mx-auto flex min-h-dvh w-full max-w-phone flex-col bg-surface px-6 pt-4 pb-8 text-content">
      {back ? (
        <header className="-ml-3 self-start">
          <Button variant="text" onClick={back.onBack}>
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
  );
}
