import { t } from '@rivr/i18n';
import type { ReactNode } from 'react';
import { Button } from '../Button/Button.tsx';
import { routeClick, type Navigate } from '../internal/navigation.ts';
import { Wordmark } from '../Wordmark/Wordmark.tsx';

export interface WebShellLink {
  /** Already translated. */
  label: string;
  href: string;
}

export interface WebShellProps {
  /** The page's website blocks. */
  children: ReactNode;
  links: readonly WebShellLink[];
  homeHref?: string;
  /** The header's one action, outlined: `Reserve a seat` (#441). */
  action?: { readonly label: string; readonly href: string } | undefined;
  /** The footer block: address, licence, links. */
  footer?: ReactNode;
  onNavigate?: Navigate | undefined;
}

/**
 * The public website frame: a header that stays at the top on a wide screen, with the club name, its links and one action,
 * the page's blocks in their bands (decision 0118), and the footer. Astro pages render it inside `body` and add only document elements around it.
 */
export function WebShell({ children, links, homeHref = '/', action, footer, onNavigate }: WebShellProps) {
  return (
    <div className="flex min-h-dvh flex-col bg-surface text-content">
      <header className="border-b border-hairline bg-raised tablet:sticky tablet:top-0 tablet:z-nav">
        {/* On a phone the action sits beside the wordmark and the links scroll in one row beneath, rather than widening the page. */}
        <div className="mx-auto flex min-h-header max-w-console flex-wrap items-center justify-between gap-x-6 px-6 py-1">
          <a href={homeHref} onClick={(event) => routeClick(event, homeHref, onNavigate)} className="flex rounded-sm">
            <Wordmark />
          </a>
          <nav aria-label={t('ui.web.navigation')} className="order-last w-full tablet:order-none tablet:w-auto">
            <ul className="flex items-center gap-x-6 overflow-x-auto tablet:flex-wrap tablet:overflow-visible">
              {links.map((link) => (
                <li key={link.href}>
                  <a
                    href={link.href}
                    onClick={(event) => routeClick(event, link.href, onNavigate)}
                    className="flex min-h-touch items-center whitespace-nowrap font-text text-14 text-content-muted transition-colors hover:text-content"
                  >
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          </nav>
          {action ? (
            <Button variant="secondary" href={action.href}>
              {action.label}
            </Button>
          ) : null}
        </div>
      </header>
      <main className="flex-1">{children}</main>
      {footer ? (
        <footer className="border-t border-hairline bg-raised">
          <div className="mx-auto max-w-console px-6 py-12">{footer}</div>
        </footer>
      ) : null}
    </div>
  );
}
