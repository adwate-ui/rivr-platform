import { t } from '@rivr/i18n';
import { useEffect, useRef, useState } from 'react';
import { Button } from '../Button/index.ts';
import type { ButtonSize } from '../Button/Button.tsx';

// How long the confirmation waits for its second press before it turns back.
const ASK_FOR_MS = 5000;

export interface ConfirmButtonProps {
  /** The step, a verb: "Leaves". */
  label: string;
  /** A fuller name for a screen reader, where the label alone repeats in a list: "Leaves: Ritika Das". It starts with the label. */
  name?: string;
  /** The second press, saying plainly what the step does: "Yes, Ritika leaves". */
  confirm: string;
  /**
   * The first button's look: a text button in a list, secondary for a row's action, primary for a page's main step;
   * on the console (console v3), subtle in place of secondary.
   */
  variant?: 'text' | 'secondary' | 'subtle' | 'primary';
  /** Both presses' size: on the console, `compact` or `small` (console v3). */
  size?: ButtonSize;
  /** While the step runs: the button shows it and takes no press, so it is never sent twice. */
  isBusy?: boolean;
  isDisabled?: boolean;
  onConfirm: () => void;
}

/** Turns the confirmation back. Cancel goes with it, so focus that was on Cancel goes to the button. */
function turnBack(wrap: HTMLSpanElement | null, setAsking: (isAsking: boolean) => void) {
  const hadFocus = wrap?.contains(document.activeElement) === true;
  setAsking(false);
  if (hadFocus) wrap?.querySelector('button')?.focus();
}

/**
 * A step that cannot be undone, asked twice in the same place: the first press turns the button into its danger
 * confirmation, with Cancel beside it, and the second does the step. Left alone for five seconds, on Escape or on Cancel,
 * the confirmation turns back, so a later stray tap never does the step. It is one button that changes, so focus and the
 * hand stay on it.
 */
export function ConfirmButton({ label, name, confirm, variant = 'text', size = 'regular', isBusy = false, isDisabled = false, onConfirm }: ConfirmButtonProps) {
  const [isAsking, setAsking] = useState(false);
  const wrap = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    if (!isAsking) return undefined;
    const timer = setTimeout(() => turnBack(wrap.current, setAsking), ASK_FOR_MS);
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') turnBack(wrap.current, setAsking); };
    document.addEventListener('keydown', onKey);
    return () => { clearTimeout(timer); document.removeEventListener('keydown', onKey); };
  }, [isAsking]);
  // The button is the first child in both states, so it stays the same element and keeps the focus.
  return (
    <span ref={wrap} className="inline-flex flex-wrap items-center gap-2">
      {isAsking ? (
        <Button variant="danger" size={size} isDisabled={isDisabled} onClick={() => { setAsking(false); onConfirm(); }}>{confirm}</Button>
      ) : (
        <Button variant={variant} size={size} {...(name === undefined ? {} : { 'aria-label': name })} isLoading={isBusy} isDisabled={isDisabled}
          onClick={() => setAsking(true)}>{label}</Button>
      )}
      {isAsking ? <Button variant="text" size={size} onClick={() => turnBack(wrap.current, setAsking)}>{t('common.cancel')}</Button> : null}
    </span>
  );
}
