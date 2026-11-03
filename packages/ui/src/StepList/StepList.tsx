import { t } from '@rivr/i18n';
import type { ReactNode } from 'react';
import { Icon } from '../Icon/Icon.tsx';
import { cx } from '../internal/classes.ts';
import { Text } from '../Text/Text.tsx';

export type StepState = 'done' | 'current' | 'next';

export interface Step {
  /** The step's name: "Selfie". */
  readonly title: string;
  /** One line on what it asks for: "Your Aadhaar and the code sent to its mobile." */
  readonly detail?: string | undefined;
  readonly state: StepState;
  /** In the `cards` look: the step's button at the end of its card, such as Switch to practice; disabled until it is the step's turn. */
  readonly action?: ReactNode;
  /** In the `cards` look: what the step holds under its words, such as the venue's name to type. */
  readonly content?: ReactNode;
}

export interface StepListProps {
  /** What the steps are, read out: "Identity check". */
  label: string;
  steps: readonly Step[];
  /**
   * `ruled`, each step between hairlines, as the player redesign's identity steps (decision 0320); `cards`, each step a
   * raised card holding its own action and content, as the console's practice reset and purge (console v3); `joined` by a
   * line otherwise.
   */
  look?: 'joined' | 'ruled' | 'cards';
}

const MARKER: Record<StepState, string> = {
  done: 'border-content bg-content text-on-cream',
  current: 'border-accent text-accent',
  next: 'border-control text-content-muted',
};

/** A step's mark: a tick once done, else its number, gold for the one the person is on. */
function Marker({ number, state }: { number: number; state: StepState }) {
  return (
    <span aria-hidden="true" className={cx('flex size-8 shrink-0 items-center justify-center rounded-full border font-text text-14 font-medium', MARKER[state])}>
      {state === 'done' ? <Icon name="check" size="sm" /> : number}
    </span>
  );
}

/** A step's name, read with whether it is done or current, and what it asks for. */
function StepWords({ step }: { step: Step }) {
  return (
    <span className="flex min-w-0 flex-1 flex-col gap-1">
      <Text as="span" weight="medium" tone={step.state === 'next' ? 'muted' : 'default'}>
        {step.title}
        {step.state === 'next' ? null : <span className="sr-only">{`, ${t(`ui.steps.${step.state}`)}`}</span>}
      </Text>
      {step.detail ? <Text as="span" variant="small" tone="muted">{step.detail}</Text> : null}
    </span>
  );
}

/**
 * A step as a raised card (console v3): its mark, words and action on one line, centred on each other (on a phone the
 * action under the words), and what it holds under the words.
 */
function CardStep({ step, number }: { step: Step; number: number }) {
  return (
    <li aria-current={step.state === 'current' ? 'step' : undefined} className="flex flex-col gap-4 rounded-lg bg-raised p-4">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
        <Marker number={number} state={step.state} />
        <StepWords step={step} />
        {step.action ? <div className="flex shrink-0 max-medium:w-full max-medium:ps-12">{step.action}</div> : null}
      </div>
      {step.content ? <div className="min-w-0 medium:ps-12">{step.content}</div> : null}
    </li>
  );
}

/**
 * The steps of a flow and where the person is in it (K-09): each step's number, name and what it asks for, a tick for those
 * done, the current one in gold, joined by a hairline. Read out as an ordered list, the current step marked as such.
 */
export function StepList({ label, steps, look = 'joined' }: StepListProps) {
  if (look === 'cards') {
    return (
      <ol role="list" aria-label={label} className="flex flex-col gap-3">
        {steps.map((step, index) => <CardStep key={step.title} step={step} number={index + 1} />)}
      </ol>
    );
  }
  const isRuled = look === 'ruled';
  return (
    // An explicit list role: a list drawn without bullets loses its semantics in Safari with VoiceOver.
    <ol role="list" aria-label={label} className="flex flex-col">
      {steps.map((step, index) => (
        <li key={step.title} aria-current={step.state === 'current' ? 'step' : undefined}
          className={cx('relative flex gap-4', isRuled ? 'border-t border-hairline py-4 last:border-b' : 'pb-6 last:pb-0')}>
          {!isRuled && index < steps.length - 1 ? <span aria-hidden="true" className="absolute top-8 bottom-0 start-4 border-s border-hairline" /> : null}
          <Marker number={index + 1} state={step.state} />
          <span className="flex min-w-0 pt-1"><StepWords step={step} /></span>
        </li>
      ))}
    </ol>
  );
}
