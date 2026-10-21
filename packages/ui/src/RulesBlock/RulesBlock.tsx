import { Heading } from '../Heading/Heading.tsx';
import { Text } from '../Text/Text.tsx';

export interface RulesBlockProps {
  heading?: string | undefined;
  /** The rules in order, each shown with its number. */
  rules: readonly string[];
}

/** A website block of numbered rules, such as the house rules. */
export function RulesBlock({ heading, rules }: RulesBlockProps) {
  return (
    <section className="mx-auto flex max-w-console flex-col gap-4 px-6 py-16 tablet:py-24">
      {heading ? <Heading level={2} variant="band">{heading}</Heading> : null}
      <ol className="flex max-w-text list-decimal flex-col gap-3 pl-6 marker:text-content-muted">
        {rules.map((rule, position) => (
          <li key={`${String(position)}-${rule}`} className="pl-2">
            <Text>{rule}</Text>
          </li>
        ))}
      </ol>
    </section>
  );
}
