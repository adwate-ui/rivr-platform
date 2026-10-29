import { Text } from '../Text/Text.tsx';
import { Wordmark } from '../Wordmark/Wordmark.tsx';

export interface WebFooterLink {
  /** Already translated: `House rules`. */
  label: string;
  href: string;
}

/** One column of the footer's links, under its heading: `Policies`. */
export interface WebFooterColumn {
  heading: string;
  links: readonly WebFooterLink[];
}

export interface WebFooterProps {
  /** Where the club is. */
  address: string;
  /** The line every page carries: `Strictly 18+. Poker is a game of skill.` */
  notice: string;
  /** The columns of links, as grandpokerarena.com's footer has them (#616): the club, play, policies, the helplines. */
  columns: readonly WebFooterColumn[];
  /** `© 2026 RIVR Poker Club`. */
  copyright: string;
  /** The label of the button that opens the cookie choices again (#616); none without a cookie banner. */
  cookieSettings?: string | undefined;
}

const LINK = 'flex min-h-touch items-center font-text text-14 text-content-muted transition-colors hover:text-content';

/** The public website's footer (#441): the wordmark and where the club is, its columns of links, its 18+ line and copyright. */
export function WebFooter({ address, notice, columns, copyright, cookieSettings }: WebFooterProps) {
  return (
    <div className="flex flex-col gap-10">
      <div className="flex flex-col gap-8 tablet:flex-row tablet:items-start tablet:justify-between">
        <div className="flex flex-col gap-3">
          <Wordmark />
          <address className="not-italic">
            <Text tone="muted">{address}</Text>
          </address>
        </div>
        {columns.map((column) => (
          <nav key={column.heading} aria-label={column.heading} className="flex flex-col gap-2">
            <Text variant="eyebrow">{column.heading}</Text>
            <ul className="flex flex-col">
              {column.links.map((link) => (
                <li key={link.href}>
                  <a href={link.href} className={LINK}>{link.label}</a>
                </li>
              ))}
            </ul>
          </nav>
        ))}
      </div>
      <div className="flex flex-col gap-2 border-t border-hairline pt-6 tablet:flex-row tablet:items-center tablet:justify-between">
        <Text variant="small" tone="muted">{notice}</Text>
        <div className="flex flex-wrap items-center gap-x-6">
          {/* The page's own script opens the cookie banner from this button (data-cookie-settings). */}
          {cookieSettings ? <button type="button" data-cookie-settings="" className={LINK}>{cookieSettings}</button> : null}
          <Text variant="small" tone="muted">{copyright}</Text>
        </div>
      </div>
    </div>
  );
}
