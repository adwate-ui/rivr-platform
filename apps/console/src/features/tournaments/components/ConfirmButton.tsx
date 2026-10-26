import { Button } from '@rivr/ui';
import { useState } from 'react';

interface ConfirmButtonProps {
  label: string;
  /** What the first button is called for a screen reader, when its label alone is not enough ("Record Neha’s bust-out"). */
  name?: string;
  confirm: string;
  /** The first button's look: a text button in a list, primary for the page's main step. */
  variant?: 'text' | 'primary';
  isBusy?: boolean;
  onConfirm: () => void;
}

/** A step asked twice in the same place: the first press turns the button into its red confirmation (a bust, a refund, a finish). */
export function ConfirmButton({ label, name, confirm, variant = 'text', isBusy = false, onConfirm }: ConfirmButtonProps) {
  const [isAsking, setAsking] = useState(false);
  if (!isAsking) return <Button variant={variant} aria-label={name ?? label} onClick={() => setAsking(true)}>{label}</Button>;
  return <Button variant="danger" isLoading={isBusy} onClick={() => { setAsking(false); onConfirm(); }}>{confirm}</Button>;
}
