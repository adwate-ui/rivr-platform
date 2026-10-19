import { Button } from '../Button/Button.tsx';
import { Heading } from '../Heading/Heading.tsx';

export interface LinksBlockLink {
  readonly label: string;
  readonly href: string;
}

export interface LinksBlockProps {
  heading?: string | undefined;
  /** The first is the page's gold action; the rest are secondary. */
  links: readonly LinksBlockLink[];
}

/** A website block of large stacked links at phone width, as a link-in-bio page leads with. */
export function LinksBlock({ heading, links }: LinksBlockProps) {
  return (
    <section className="mx-auto flex w-full max-w-phone flex-col gap-3 px-6 py-6">
      {heading ? <Heading level={2}>{heading}</Heading> : null}
      {links.map((link, position) => (
        <Button key={link.href} variant={position === 0 ? 'primary' : 'secondary'} size="large" href={link.href} fullWidth>
          {link.label}
        </Button>
      ))}
    </section>
  );
}
