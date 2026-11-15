import { Button } from '../Button/Button.tsx';

export interface SummaryStripProps {
  /** What it sums up, in small capitals: "High hand bonus". Names the strip for a screen reader. */
  label: string;
  /** The first fact, in bold: "2 hands paid tonight". */
  lead: string;
  /** Further facts, each kept whole: "15,000 Bonus". */
  facts?: readonly string[];
  /** The fact needed least, cut short where the line has no room: "Last: Siddharth Vaid, Four Nines, 01:12". */
  detail?: string | undefined;
  /** The one thing to do from it: "Log a high hand". */
  action?: { label: string; onPress: () => void } | undefined;
}

const FACT = 'shrink-0 font-text text-14 leading-snug';

/**
 * A night's running summary across the top of a console screen, on one line at every width (redesign RD-24): what it is,
 * its figures and one action. The label, the lead, the facts and the action keep their width; the detail takes what is
 * left and is cut short, its full words in its title.
 */
export function SummaryStrip({ label, lead, facts = [], detail, action }: SummaryStripProps) {
  return (
    <section aria-label={label} className="flex min-h-12 items-center gap-4 rounded-lg border border-gold-edge bg-raised py-2 pr-2 pl-4 whitespace-nowrap text-content">
      <span className="shrink-0 font-text text-12 leading-snug font-medium tracking-wide text-content-muted uppercase">{label}</span>
      <span className={`${FACT} font-semibold`}>{lead}</span>
      {facts.map((fact) => <span key={fact} className={`${FACT} text-content-muted`}>{fact}</span>)}
      <span title={detail} className="min-w-0 flex-1 truncate font-text text-14 leading-snug text-content-muted">{detail}</span>
      {action === undefined ? null : <Button variant="subtle" size="compact" onClick={action.onPress}>{action.label}</Button>}
    </section>
  );
}
