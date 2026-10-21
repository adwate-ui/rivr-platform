import { Button } from '../Button/Button.tsx';
import { Heading } from '../Heading/Heading.tsx';
import { Text } from '../Text/Text.tsx';

export interface StatementBlockProps {
  /** A line above: `The RIVR difference`. */
  eyebrow?: string | undefined;
  /** One to three short lines, each set on its own line: `Not luck.`, `A game of skill.` */
  lines: readonly string[];
  text?: string | undefined;
  /** The band's one gold action, a link into the player app. */
  action?: { readonly label: string; readonly href: string } | undefined;
  /** One of the club's stills behind the lines, darkened so they read (decision 0118). */
  image?: string | undefined;
}

/**
 * A website block of a line or three set large across the page (#441): the club's manifesto, or its last
 * word before the footer, over a darkened still of the room when it has one.
 */
export function StatementBlock({ eyebrow, lines, text, action, image }: StatementBlockProps) {
  return (
    <section className="relative overflow-hidden">
      {image ? (
        <>
          <img src={image} alt="" className="absolute inset-0 size-full object-cover" />
          <div className="absolute inset-0 bg-green-black opacity-muted" />
        </>
      ) : null}
      <div className="relative mx-auto flex max-w-console flex-col items-center gap-6 px-6 py-24 text-center tablet:py-32">
        {eyebrow ? <Text variant="eyebrow" tone="accent">{eyebrow}</Text> : null}
        <Heading level={2} variant="statement" align="center">
          {lines.map((line) => (
            <span key={line} className="block">{line}</span>
          ))}
        </Heading>
        {text ? (
          <div className="max-w-text">
            <Text variant="lead" tone="muted" align="center">{text}</Text>
          </div>
        ) : null}
        {action ? (
          <Button variant="primary" size="large" href={action.href}>
            {action.label}
          </Button>
        ) : null}
      </div>
    </section>
  );
}
