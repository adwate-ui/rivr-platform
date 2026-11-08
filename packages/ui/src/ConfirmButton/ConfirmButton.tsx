import { t } from '@rivr/i18n';
import { useEffect, useRef, useState, type RefObject } from 'react';
import { Button, type ButtonSize, type ButtonVariant } from '../Button/index.ts';

// How long the confirmation waits for its second press before it turns back: 20 s, held while the pointer or the focus is
// on it (WCAG 2.2.1), so a later stray tap elsewhere still never does the step.
const ASK_FOR_MS = 20_000;

export interface ConfirmButtonProps {
  /** The step, a verb: "Leaves". */
  label: string;
  /** A fuller name for a screen reader, where the label alone repeats in a list: "Leaves: Ritika Das". It starts with the label. */
  name?: string;
  /** The second press, saying plainly what the step does: "Yes, Ritika leaves". */
  confirm: string;
  /**
   * The first button's look: a text button in a list, secondary for a row's action, primary for a page's main step; on the
   * console (decision 0464), subtle for a row's action.
   */
  variant?: Extract<ButtonVariant, 'text' | 'secondary' | 'subtle' | 'primary'>;
  /** Both buttons' size: the console's `small` inside a row (decision 0464). */
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

/** The confirmation's time: 20 s, counted only while neither the pointer nor the focus is on it; Escape turns it back. */
function useAskingTime(isAsking: boolean, isHeld: boolean, wrap: RefObject<HTMLSpanElement | null>, setAsking: (isAsking: boolean) => void) {
  useEffect(() => {
    if (!isAsking) return undefined;
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') turnBack(wrap.current, setAsking); };
    document.addEventListener('keydown', onKey);
    const timer = isHeld ? undefined : setTimeout(() => turnBack(wrap.current, setAsking), ASK_FOR_MS);
    return () => { clearTimeout(timer); document.removeEventListener('keydown', onKey); };
  }, [isAsking, isHeld, wrap, setAsking]);
}

/**
 * A step that cannot be undone, asked twice in the same place: the first press turns the button into its danger
 * confirmation, with Cancel beside it, and "Confirm or cancel." is read out; the second press does the step. Left alone for
 * 20 seconds (the time held while the pointer or focus is on it), on Escape or on Cancel, the confirmation turns back, so a
 * later stray tap never does the step. It is one button that changes, so focus and the hand stay on it.
 */
export function ConfirmButton({ label, name, confirm, variant = 'text', size = 'regular', isBusy = false, isDisabled = false, onConfirm }: ConfirmButtonProps) {
  const [isAsking, setAsking] = useState(false);
  const [isHeld, setHeld] = useState(false);
  const wrap = useRef<HTMLSpanElement>(null);
  useAskingTime(isAsking, isHeld, wrap, setAsking);
  // The button is the first child in both states, so it stays the same element and keeps the focus.
  return (
    <span ref={wrap} className="inline-flex flex-wrap items-center gap-2" onPointerEnter={() => setHeld(true)} onPointerLeave={() => setHeld(false)}
      onFocus={() => setHeld(true)} onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) setHeld(false); }}>
      {isAsking ? (
        <Button variant="danger" size={size} isDisabled={isDisabled} onClick={() => { setAsking(false); onConfirm(); }}>{confirm}</Button>
      ) : (
        <Button variant={variant} size={size} {...(name === undefined ? {} : { 'aria-label': name })} isLoading={isBusy} isDisabled={isDisabled}
          onClick={() => setAsking(true)}>{label}</Button>
      )}
      {isAsking ? <Button variant="text" size={size} onClick={() => turnBack(wrap.current, setAsking)}>{t('common.cancel')}</Button> : null}
      <span role="status" className="sr-only">{isAsking ? t('ui.confirm.asking') : ''}</span>
    </span>
  );
}
