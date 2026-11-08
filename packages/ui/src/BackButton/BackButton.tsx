import { Button } from '../Button/Button.tsx';

export interface BackButtonProps {
  /** Where it goes back to, named: "Tonight", "Sessions", "Profile", or "Back" to the last tab. */
  label: string;
  onBack: () => void;
}

/**
 * The way back at the top of a pushed screen (decision 0320): a chevron and where it goes, the chevron's ink on the page's
 * edge (F-157): the text button's padding (12 px) and the chevron's own side bearing (7.5 of its 20 px) sit outside it,
 * as StepScreen's back does.
 */
export function BackButton({ label, onBack }: BackButtonProps) {
  return (
    <div className="-ml-5 self-start">
      <Button variant="text" icon="chevronLeft" onClick={onBack}>{label}</Button>
    </div>
  );
}
