import { formatNumber, t } from '@rivr/i18n';
import { useLayoutEffect, useRef, useState } from 'react';
import { cx } from '../internal/classes.ts';

type StepState = 'done' | 'current' | 'next';

const BAR: Record<StepState, string> = { done: 'bg-gold', current: 'bg-cream', next: 'bg-cream-track' };
const NAME: Record<StepState, string> = { done: 'text-content-muted', current: 'font-semibold text-content', next: 'text-content-muted' };

function stateOf(index: number, current: number): StepState {
  if (index < current) return 'done';
  return index === current ? 'current' : 'next';
}

/** Whether the names, each on one line, fit side by side with the gaps between their columns. */
function namesFit(list: HTMLElement): boolean {
  const widths = [...list.querySelectorAll('[data-step-name]')].map((name) => Math.ceil(name.getBoundingClientRect().width));
  const gap = Number.parseFloat(getComputedStyle(list).columnGap) || 0;
  return widths.reduce((sum, width) => sum + width, 0) + gap * (widths.length - 1) <= list.clientWidth;
}

/**
 * Whether every step can be named, measured again as the bar is resized, the step changes (the current name is bolder,
 * so wider) or the font arrives. True until measured, and where nothing is laid out.
 */
function useNamesFit(names: string, current: number) {
  const list = useRef<HTMLOListElement>(null);
  const [fits, setFits] = useState(true);
  useLayoutEffect(() => {
    const element = list.current;
    if (element === null) return undefined;
    const measure = () => setFits(namesFit(element));
    measure();
    void document.fonts?.ready.then(measure);
    if (typeof ResizeObserver === 'undefined') return undefined;
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, [names, current]);
  return { list, fits };
}

export interface ProgressStepsProps {
  steps: readonly string[];
  current: number;
  label: string;
}

/**
 * Stepper's `progress` look (redesign RD-15): a bar and a name for each step of a flow the person is taken through, the
 * steps done in gold, the current one in cream with its name bold, those to come faint. A column is as wide as its name
 * needs, so names never touch; where they do not all fit, only the current step is named, under bars of one width.
 * Every step stays in the list a screen reader reads, and the step reached is said as it changes: "Step 3 of 5: PAN card".
 */
export function ProgressSteps({ steps, current, label }: ProgressStepsProps) {
  const { list, fits } = useNamesFit(steps.join('\n'), current);
  const name = steps[current] ?? '';
  const column = fits ? 'minmax(max-content, 1fr)' : 'minmax(0, 1fr)';
  return (
    <div className="flex flex-col gap-2">
      <ol ref={list} aria-label={label} className="grid gap-2" style={{ gridTemplateColumns: `repeat(${String(steps.length)}, ${column})` }}>
        {steps.map((step, index) => {
          const state = stateOf(index, current);
          return (
            <li key={step} aria-current={state === 'current' ? 'step' : undefined} className={cx('flex min-w-0 flex-col', fits && 'gap-2')}>
              <span aria-hidden="true" className={cx('h-1 rounded-full transition-colors', BAR[state])} />
              {/* Kept on one line and measurable, though unseen while only the current step is named. */}
              <span className={cx('block overflow-hidden whitespace-nowrap font-text text-12', NAME[state], !fits && 'h-1 opacity-0')}>
                <span data-step-name>{step}</span>
              </span>
              {state === 'next' ? null : <span className="sr-only">{`, ${t(`ui.steps.${state}`)}`}</span>}
            </li>
          );
        })}
      </ol>
      {fits ? null : <span aria-hidden="true" className="font-text text-12 font-semibold text-content">{name}</span>}
      <span role="status" className="sr-only">{t('ui.console.stepper.position', { number: formatNumber(current + 1), total: formatNumber(steps.length), name })}</span>
    </div>
  );
}
