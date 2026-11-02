import { Heading } from '../Heading/Heading.tsx';
import { Icon } from '../Icon/Icon.tsx';
import { Text } from '../Text/Text.tsx';

export interface FaqQuestion {
  readonly question: string;
  readonly answer: string;
}

export interface FaqBlockProps {
  heading?: string | undefined;
  questions: readonly FaqQuestion[];
}

/** A website block of questions, each opening to its answer, a chevron on its right turning as it opens (W-10). Works without JavaScript. */
export function FaqBlock({ heading, questions }: FaqBlockProps) {
  return (
    <section className="mx-auto flex max-w-console flex-col gap-4 px-6 py-16 tablet:py-24">
      {heading ? <Heading level={2} variant="band">{heading}</Heading> : null}
      <div className="flex max-w-text flex-col divide-y divide-hairline">
        {questions.map(({ question, answer }) => (
          <details key={question} className="group py-4">
            <summary className="flex min-h-touch cursor-pointer items-center justify-between gap-4 py-2 font-text text-18 font-medium text-content">
              {question}
              <span className="flex shrink-0 motion-safe:transition-transform group-open:rotate-180"><Icon name="chevronDown" size="sm" /></span>
            </summary>
            <Text tone="muted">{answer}</Text>
          </details>
        ))}
      </div>
    </section>
  );
}
