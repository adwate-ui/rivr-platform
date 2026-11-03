import { Button } from '../Button/Button.tsx';

/** One of the request's two actions: what it says, the name it is read with, and what it does. */
export interface JoinRequestAction {
  /** Already translated: "Approve", "Decline". */
  readonly label: string;
  /** Read in place of the label, with who asks: "Approve Ritika Bhalla". */
  readonly name: string;
  readonly onClick: () => void;
  readonly isLoading?: boolean | undefined;
}

export interface JoinRequestRowProps {
  /** Who asks: "Ritika Bhalla". */
  name: string;
  /** What they ask, after the name: "asks to join". */
  note: string;
  /** The filled action: Approve. */
  approve: JoinRequestAction;
  /** The other, in words: Decline. */
  decline: JoinRequestAction;
}

/**
 * A member asking from the app to join a table's waitlist (console v3): a gold dot (it needs the floor, decision 0429), who
 * and what they ask, then Approve filled and Decline in words, on a faint gold band above the table's list.
 */
export function JoinRequestRow({ name, note, approve, decline }: JoinRequestRowProps) {
  return (
    <div className="flex min-h-touch items-center gap-2 bg-gold-tint px-4 py-1 tablet:min-h-row">
      <span aria-hidden="true" className="size-pip shrink-0 rounded-full bg-action" />
      <p className="min-w-0 flex-1 truncate font-text text-14 leading-snug text-content">
        {name}
        <span className="text-12 text-content-muted"> {note}</span>
      </p>
      <Button variant="strong" size="small" aria-label={approve.name} isLoading={approve.isLoading === true} onClick={approve.onClick}>
        {approve.label}
      </Button>
      <Button variant="text" size="small" aria-label={decline.name} isLoading={decline.isLoading === true} onClick={decline.onClick}>
        {decline.label}
      </Button>
    </div>
  );
}
