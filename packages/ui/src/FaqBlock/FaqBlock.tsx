import { Heading } from '../Heading/Heading.tsx';
import { Text } from '../Text/Text.tsx';

export interface FaqQuestion {
  readonly question: string;
  readonly answer: string;
}

export interface FaqBlockProps {
  heading?: string | undefined;
  questions: readonly FaqQuestion[];
}

/** A website block of questions, each opening to its answer. Works without JavaScript. */
export function FaqBlock({ heading, questions }: FaqBlockProps) {
  return (
    <section className="mx-auto flex max-w-console flex-col gap-4 px-6 py-16 tablet:py-24">
      {heading ? <Heading level={2} variant="band">{heading}</Heading> : null}
      <div className="flex max-w-text flex-col divide-y divide-hairline">
        {questions.map(({ question, answer }) => (
          <details key={question} className="py-4">
            <summary className="min-h-11 cursor-pointer py-2 font-text text-18 font-medium text-content">{question}</summary>
            <Text tone="muted">{answer}</Text>
          </details>
        ))}
      </div>
    </section>
  );
}
