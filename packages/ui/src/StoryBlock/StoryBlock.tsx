import { Button } from '../Button/Button.tsx';
import { Heading } from '../Heading/Heading.tsx';
import { Text } from '../Text/Text.tsx';

/** A figure under the story: `6`, `Tables, from 50/100 to the Private Room`. */
export interface StoryFigure {
  readonly value: string;
  readonly label: string;
}

export interface StoryBlockProps {
  eyebrow?: string | undefined;
  heading: string;
  /** One to three paragraphs. */
  paragraphs: readonly string[];
  /** Up to four figures in a row beneath. */
  figures?: readonly StoryFigure[] | undefined;
  /** The band's one gold action, a link into the player app. */
  action?: { readonly label: string; readonly href: string } | undefined;
  /** One of the club's photos beside the words, with what it shows. */
  image?: string | undefined;
  alt?: string | undefined;
}

/**
 * A website block of the club's story (decision 0166), as grandpokerarena.com tells its own: the words
 * beside a photo of the room, and its figures in a row beneath.
 */
export function StoryBlock({ eyebrow, heading, paragraphs, figures, action, image, alt }: StoryBlockProps) {
  return (
    <section className="mx-auto flex max-w-console flex-col gap-12 px-6 py-16 tablet:py-24">
      <div className="grid items-center gap-12 tablet:grid-cols-2">
        <div className="flex flex-col items-start gap-6">
          {eyebrow ? <Text variant="eyebrow" tone="accent">{eyebrow}</Text> : null}
          <Heading level={2} variant="band">{heading}</Heading>
          <div className="flex max-w-text flex-col gap-4">
            {paragraphs.map((paragraph) => <Text key={paragraph} variant="lead" tone="muted">{paragraph}</Text>)}
          </div>
          {action ? <Button variant="primary" size="large" href={action.href}>{action.label}</Button> : null}
        </div>
        {image ? (
          <div className="aspect-photo overflow-hidden rounded-lg border border-hairline">
            <img src={image} alt={alt ?? ''} loading="lazy" decoding="async" className="size-full object-cover" />
          </div>
        ) : null}
      </div>
      {figures && figures.length > 0 ? (
        <dl className="grid grid-cols-2 gap-8 border-t border-hairline pt-10 tablet:grid-cols-4">
          {figures.map((figure) => (
            <div key={figure.label} className="flex flex-col-reverse gap-2">
              <dt><Text tone="muted">{figure.label}</Text></dt>
              <dd className="font-display text-56 leading-tight text-content">{figure.value}</dd>
            </div>
          ))}
        </dl>
      ) : null}
    </section>
  );
}
