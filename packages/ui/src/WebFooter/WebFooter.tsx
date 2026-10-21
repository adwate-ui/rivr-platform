import { Text } from '../Text/Text.tsx';
import { Wordmark } from '../Wordmark/Wordmark.tsx';

export interface WebFooterLink {
  /** Already translated: `@rivr.pokerclub`. */
  label: string;
  href: string;
}

export interface WebFooterProps {
  /** Where the club is. */
  address: string;
  /** The line every page carries: `Strictly 18+. Poker is a game of skill.` */
  notice: string;
  /** How to reach the club: Instagram, email. */
  links: readonly WebFooterLink[];
}

/** The public website's footer (#441): the wordmark and where the club is, how to reach it, and its 18+ line. */
export function WebFooter({ address, notice, links }: WebFooterProps) {
  return (
    <div className="flex flex-col gap-8 tablet:flex-row tablet:items-start tablet:justify-between">
      <div className="flex flex-col gap-3">
        <Wordmark />
        <address className="not-italic">
          <Text tone="muted">{address}</Text>
        </address>
      </div>
      {links.length > 0 ? (
        <ul className="flex flex-col gap-2">
          {links.map((link) => (
            <li key={link.href}>
              <a href={link.href} className="flex min-h-touch items-center font-text text-14 text-content-muted transition-colors hover:text-content">
                {link.label}
              </a>
            </li>
          ))}
        </ul>
      ) : null}
      <Text variant="small" tone="muted">{notice}</Text>
    </div>
  );
}
