import { Button } from '../Button/Button.tsx';

export interface BackButtonProps {
  /** Where it goes back to, named: "Tonight", "Sessions", "Profile", or "Back" to the last tab. */
  label: string;
  onBack: () => void;
}

/**
 * The way back at the top of a pushed screen (decision 0320): a chevron and where it goes, its words in line with the
 * screen's title below (the text button's own padding sits outside the page edge, as StepScreen's back does).
 */
export function BackButton({ label, onBack }: BackButtonProps) {
  return (
    <div className="-ml-3 self-start">
      <Button variant="text" icon="chevronLeft" onClick={onBack}>{label}</Button>
    </div>
  );
}
