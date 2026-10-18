import { Button } from '../Button/Button.tsx';
import { Heading } from '../Heading/Heading.tsx';
import { Text } from '../Text/Text.tsx';

export interface HeroBlockProps {
  /** The page's one h1. */
  heading: string;
  text?: string | undefined;
  /** The page's one gold action, a link: on the website, the hand-off to the player app. */
  action?: { readonly label: string; readonly href: string } | undefined;
}

/** A website page's opening block: the heading, a line or two, and the action. */
export function HeroBlock({ heading, text, action }: HeroBlockProps) {
  return (
    <section className="mx-auto flex max-w-console flex-col items-start gap-6 px-6 py-16">
      <Heading level={1} variant="display">
        {heading}
      </Heading>
      {text ? (
        <div className="max-w-text">
          <Text variant="lead">{text}</Text>
        </div>
      ) : null}
      {action ? (
        <Button variant="primary" href={action.href}>
          {action.label}
        </Button>
      ) : null}
    </section>
  );
}
