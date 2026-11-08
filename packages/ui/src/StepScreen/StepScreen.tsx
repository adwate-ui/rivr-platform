import type { FormEvent, ReactNode } from 'react';
import { Button } from '../Button/Button.tsx';
import { DeskHelp } from '../DeskHelp/DeskHelp.tsx';
import { Heading, type SerifSize } from '../Heading/Heading.tsx';
import { Icon } from '../Icon/Icon.tsx';
import { cx } from '../internal/classes.ts';
import { usePageTitle } from '../Screen/Screen.tsx';
import { Text } from '../Text/Text.tsx';

export interface StepScreenProps {
  /** The step's content: a field, a lockup, a document photo. */
  children: ReactNode;
  /** At the bottom of the screen: the step's one action, with a field above it when the field belongs there. */
  footer: ReactNode;
  /** The step's heading, a noun ("Code"). Leave it out when the content names the screen itself. */
  title?: string | undefined;
  /** The page's name when the step draws its own heading in place of `title`: "Sign in", "Verified" (WCAG 2.4.2). */
  pageTitle?: string | undefined;
  /** A way to the previous step, top left. */
  back?: { label: string; onBack: () => void } | undefined;
  /**
   * The player redesign's step (decision 0320): the title in the display face at `serifSize` (36 unless given), a gold
   * `eyebrow` above it and a muted `subtitle` under it, and a chevron on Back. Otherwise the text face's step title.
   */
  look?: StepLook | undefined;
  /** `top` sets the content under the title; `center` sets it in the middle of the screen. */
  align?: 'top' | 'center';
  /**
   * Makes the step a form: Enter in a field, the keyboard's Go key or a `type="submit"` button
   * calls this, and the page never reloads. React Hook Form's `handleSubmit(onValid)` fits as is.
   */
  onSubmit?: ((event: FormEvent<HTMLFormElement>) => void | Promise<void>) | undefined;
}

// Under Back, the content keeps 24 px from it; with no Back, a panel's own 40 px is the inset from 768 px (F-065).
const ALIGN = { top: 'pt-6', topAlone: 'pt-6 medium:pt-0', center: 'items-center justify-center' } as const;

const BACK_CHEVRON = { icon: 'chevronLeft' } as const;

const FOOTER_RULED = '-mx-5 border-t border-hairline px-5 pt-3';

/** The redesign's step: its title's size, eyebrow and subtitle; a bar of the steps in place of Back's words; a ruled footer. */
export interface StepLook {
  serifSize?: SerifSize;
  eyebrow?: string | undefined;
  subtitle?: string | undefined;
  /** Sign-up's top bar: the chevron back, a segment a step (gold to this one) and "1 of 2". */
  progress?: { step: number; of: number; label: string } | undefined;
  /** A gold hairline over the footer, which stays at the foot as the fields scroll. */
  isFooterRuled?: boolean;
}

/** The way back: sign-up's bar of steps, or Back's words, with a chevron in the redesign. */
function StepBack({ back, look }: { back: { label: string; onBack: () => void }; look: StepLook | undefined }) {
  if (look?.progress) return <ProgressBack back={back} progress={look.progress} />;
  return (
    // Its chevron's ink on the page's edge, past the button's padding and the chevron's side bearing (F-157), as BackButton.
    <header className={cx('self-start', look ? '-ml-5' : '-ml-3')}>
      <Button variant="text" onClick={back.onBack} {...(look ? BACK_CHEVRON : {})}>
        {back.label}
      </Button>
    </header>
  );
}

/** Back as a chevron, then a segment a step, gold up to this one, then where the member is: "1 of 2". */
function ProgressBack({ back, progress }: { back: { label: string; onBack: () => void }; progress: NonNullable<StepLook['progress']> }) {
  return (
    // The chevron at BackButton's size, its ink on the page's edge (F-157, F-177): the 44 px target's 12 px either side of it
    // and its side bearing sit outside.
    <header className="-ml-5 flex items-center gap-4">
      <button type="button" aria-label={back.label} onClick={back.onBack} className="flex size-touch shrink-0 items-center justify-center text-content">
        <Icon name="chevronLeft" size="md" />
      </button>
      <span aria-hidden="true" className="grid flex-1 grid-flow-col gap-2">
        {Array.from({ length: progress.of }, (_, index) => (
          <span key={index} className={cx('h-1 rounded-full', index < progress.step ? 'bg-gold' : 'bg-cream-track')} />
        ))}
      </span>
      <Text as="span" variant="small" tone="muted">{progress.label}</Text>
    </header>
  );
}

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
 * page furniture, so a screen reader jumping to main finds the field and the button. Under it, the way to the front desk
 * (`DeskHelp`), in the player app. From 768 px,
 * on a tablet or a computer, the step is a panel in the middle of the screen, its action under its
 * content, not the phone's column stretched to the screen's foot (S-01).
 */
export function StepScreen({ children, footer, title, pageTitle, back, align = 'top', onSubmit, look }: StepScreenProps) {
  // The step names the page, "Verify with PAN · RIVR", as a screen does (WCAG 2.4.2).
  usePageTitle(title ?? pageTitle);
  const step = (
    <>
      <div className={cx('flex flex-1 flex-col gap-6', ALIGN[align === 'top' && back === undefined ? 'topAlone' : align])}>
        {title ? <StepTitle title={title} look={look} /> : null}
        {children}
      </div>
      {/* One top padding or the other: with both, the plain footer's 24 px won and the ruled footer's action sat 24 px under
          its rule, not the prototype's 12. The way to the front desk ends every step, where a DeskHelpProvider gives one. */}
      <div className={cx('flex flex-col gap-6', look?.isFooterRuled === true ? FOOTER_RULED : 'pt-6')}>{footer}<DeskHelp /></div>
    </>
  );
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void onSubmit?.(event);
  };
  return (
    <div className="safe-top safe-bottom safe-x flex min-h-dvh w-full flex-col bg-surface text-content medium:items-center medium:justify-center medium:px-6 medium:py-12">
      <div className="mx-auto flex w-full max-w-phone flex-1 flex-col px-5 pt-4 pb-8 medium:flex-none medium:rounded-lg medium:border medium:border-hairline medium:bg-raised medium:px-10 medium:py-10">
        {back ? <StepBack back={back} look={look} /> : null}
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
