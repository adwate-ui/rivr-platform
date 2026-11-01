import { useEffect, useState } from 'react';
import { Button } from '../Button/index.ts';

// How long the confirmation waits for its second press before it turns back.
const ASK_FOR_MS = 5000;

export interface ConfirmButtonProps {
  /** The step, a verb: "Leaves". */
  label: string;
  /** A fuller name for a screen reader, where the label alone repeats in a list: "Leaves: Ritika Das". It starts with the label. */
  name?: string;
  /** The second press, saying plainly what the step does: "Yes, Ritika leaves". */
  confirm: string;
  /** The first button's look: a text button in a list, secondary for a row's action, primary for a page's main step. */
  variant?: 'text' | 'secondary' | 'primary';
  /** While the step runs: the button shows it and takes no press, so it is never sent twice. */
  isBusy?: boolean;
  isDisabled?: boolean;
  onConfirm: () => void;
}

/**
 * A step that cannot be undone, asked twice in the same place: the first press turns the button into its danger
 * confirmation, and the second does the step. Left alone for five seconds, or on Escape, the confirmation turns back, so
 * a later stray tap never does the step. It is one button that changes, so focus and the hand stay on it.
 */
export function ConfirmButton({ label, name, confirm, variant = 'text', isBusy = false, isDisabled = false, onConfirm }: ConfirmButtonProps) {
  const [isAsking, setAsking] = useState(false);
  useEffect(() => {
    if (!isAsking) return undefined;
    const timer = setTimeout(() => setAsking(false), ASK_FOR_MS);
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') setAsking(false); };
    document.addEventListener('keydown', onKey);
    return () => { clearTimeout(timer); document.removeEventListener('keydown', onKey); };
  }, [isAsking]);
  if (!isAsking) {
    return (
      <Button variant={variant} {...(name === undefined ? {} : { 'aria-label': name })} isLoading={isBusy} isDisabled={isDisabled}
        onClick={() => setAsking(true)}>{label}</Button>
    );
  }
  return <Button variant="danger" isDisabled={isDisabled} onClick={() => { setAsking(false); onConfirm(); }}>{confirm}</Button>;
}
