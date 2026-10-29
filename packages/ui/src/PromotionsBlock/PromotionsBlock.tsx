import { cx } from '../internal/classes.ts';
import { Heading } from '../Heading/Heading.tsx';
import { Text } from '../Text/Text.tsx';

/** A live promotion, as published: its title, what it gives, who and when, and its rules and questions (#618). */
export interface WebPromotion {
  readonly title: string;
  readonly detail?: string | undefined;
  readonly runs?: string | undefined;
  readonly rules?: readonly string[] | undefined;
  readonly questions?: readonly { readonly question: string; readonly answer: string }[] | undefined;
}

export interface PromotionsBlockProps {
  eyebrow?: string | undefined;
  heading?: string | undefined;
  promotions: readonly WebPromotion[];
  /** What the block says while none runs: "No promotions are running just now." */
  emptyText: string;
}

/** A promotion's card: its words, then its rules in order and its questions, each opening on its answer. */
function Promotion({ promotion }: { promotion: WebPromotion }) {
  const { title, detail, runs, rules = [], questions = [] } = promotion;
  return (
    <li className="flex flex-col gap-3 rounded-lg border border-hairline p-6">
      <Heading level={3} variant="subsection">{title}</Heading>
      {detail ? <Text>{detail}</Text> : null}
      {runs ? <Text variant="small" tone="accent">{runs}</Text> : null}
      {rules.length > 0 ? (
        <ol className="flex list-decimal flex-col gap-1 pl-5 marker:text-content-muted">
          {rules.map((rule, position) => <li key={`${String(position)}-${rule}`}><Text variant="small">{rule}</Text></li>)}
        </ol>
      ) : null}
      {questions.length > 0 ? (
        <div className="flex flex-col divide-y divide-hairline">
          {questions.map(({ question, answer }) => (
            <details key={question} className="py-2">
              <summary className="min-h-11 cursor-pointer py-2 font-text text-14 font-medium text-content">{question}</summary>
              <Text variant="small" tone="muted">{answer}</Text>
            </details>
          ))}
        </div>
      ) : null}
    </li>
  );
}

/**
 * A website block of the club's live promotions (decision 0166), a card each, as the TV and Home show
 * them (#86): the title, what it gives, and who and when; with rules and questions, two across (#618).
 */
export function PromotionsBlock({ eyebrow, heading, promotions, emptyText }: PromotionsBlockProps) {
  const hasRules = promotions.some((promotion) => (promotion.rules?.length ?? 0) > 0 || (promotion.questions?.length ?? 0) > 0);
  return (
    <section className="mx-auto flex max-w-console flex-col gap-10 px-6 py-16 tablet:py-24">
      {eyebrow || heading ? (
        <div className="flex flex-col gap-3">
          {eyebrow ? <Text variant="eyebrow" tone="accent">{eyebrow}</Text> : null}
          {heading ? <Heading level={2} variant="band">{heading}</Heading> : null}
        </div>
      ) : null}
      {promotions.length === 0 ? <Text tone="muted">{emptyText}</Text> : (
        <ul className={cx('grid grid-cols-1 items-start gap-4', hasRules ? 'tablet:grid-cols-2' : 'tablet:grid-cols-3')}>
          {promotions.map((promotion) => <Promotion key={promotion.title} promotion={promotion} />)}
        </ul>
      )}
    </section>
  );
}
