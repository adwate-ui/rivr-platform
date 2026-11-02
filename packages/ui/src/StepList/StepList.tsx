import { t } from '@rivr/i18n';
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
}

export interface StepListProps {
  /** What the steps are, read out: "Identity check". */
  label: string;
  steps: readonly Step[];
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

/**
 * The steps of a flow and where the person is in it (K-09): each step's number, name and what it asks for, a tick for those
 * done, the current one in gold, joined by a hairline. Read out as an ordered list, the current step marked as such.
 */
export function StepList({ label, steps }: StepListProps) {
  return (
    // An explicit list role: a list drawn without bullets loses its semantics in Safari with VoiceOver.
    <ol role="list" aria-label={label} className="flex flex-col">
      {steps.map((step, index) => (
        <li key={step.title} aria-current={step.state === 'current' ? 'step' : undefined} className="relative flex gap-4 pb-6 last:pb-0">
          {index < steps.length - 1 ? <span aria-hidden="true" className="absolute top-8 bottom-0 start-4 border-s border-hairline" /> : null}
          <Marker number={index + 1} state={step.state} />
          <span className="flex min-w-0 flex-col gap-1 pt-1">
            <Text as="span" weight="medium" tone={step.state === 'next' ? 'muted' : 'default'}>
              {step.title}
              {step.state === 'next' ? null : <span className="sr-only">{`, ${t(`ui.steps.${step.state}`)}`}</span>}
            </Text>
            {step.detail ? <Text as="span" variant="small" tone="muted">{step.detail}</Text> : null}
          </span>
        </li>
      ))}
    </ol>
  );
}
