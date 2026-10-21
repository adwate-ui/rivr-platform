import { Heading } from '../Heading/Heading.tsx';
import { Text } from '../Text/Text.tsx';

export interface TextBlockProps {
  heading?: string | undefined;
  /** Prose; a blank line starts a new paragraph. */
  body: string;
}

/** A website block of prose: an optional heading, then its paragraphs at a comfortable line length. */
export function TextBlock({ heading, body }: TextBlockProps) {
  const paragraphs = body.split(/\n\s*\n/).map((paragraph) => paragraph.trim()).filter((paragraph) => paragraph !== '');
  return (
    <section className="mx-auto flex max-w-console flex-col gap-4 px-6 py-16 tablet:py-24">
      {heading ? <Heading level={2} variant="band">{heading}</Heading> : null}
      <div className="flex max-w-text flex-col gap-4">
        {paragraphs.map((paragraph, position) => (
          <Text key={`${String(position)}-${paragraph}`}>{paragraph}</Text>
        ))}
      </div>
    </section>
  );
}
