import { Button } from '../Button/Button.tsx';
import { Heading } from '../Heading/Heading.tsx';
import { Text } from '../Text/Text.tsx';

export interface FeatureBlockProps {
  eyebrow?: string | undefined;
  heading: string;
  text?: string | undefined;
  /** Up to four short points: `Live tables`, `The waitlist`. */
  points?: readonly string[] | undefined;
  /** The band's one gold action, a link into the player app. */
  action?: { readonly label: string; readonly href: string } | undefined;
  /** An upright picture, as a phone screen: the RIVR app (#441). */
  image: string;
  alt: string;
}

/** A website block of one upright picture beside its words, such as the RIVR app on a phone (#441). */
export function FeatureBlock({ eyebrow, heading, text, points, action, image, alt }: FeatureBlockProps) {
  return (
    <section className="mx-auto grid max-w-console items-center gap-12 px-6 py-16 tablet:grid-cols-2 tablet:py-24">
      <div className="flex flex-col items-start gap-6">
        {eyebrow ? <Text variant="eyebrow" tone="accent">{eyebrow}</Text> : null}
        <Heading level={2} variant="band">{heading}</Heading>
        {text ? (
          <div className="max-w-text">
            <Text variant="lead" tone="muted">{text}</Text>
          </div>
        ) : null}
        {points && points.length > 0 ? (
          <ul className="flex flex-wrap gap-x-6 gap-y-2">
            {points.map((point) => (
              <li key={point} className="flex items-center gap-2">
                <span aria-hidden="true" className="size-1 rounded-full bg-accent" />
                <Text variant="eyebrow" as="span">{point}</Text>
              </li>
            ))}
          </ul>
        ) : null}
        {action ? (
          <Button variant="primary" size="large" href={action.href}>
            {action.label}
          </Button>
        ) : null}
      </div>
      <div className="mx-auto w-full max-w-phone tablet:order-first">
        <div className="aspect-story overflow-hidden rounded-lg border border-hairline">
          <img src={image} alt={alt} loading="lazy" decoding="async" className="size-full object-cover object-top" />
        </div>
      </div>
    </section>
  );
}
