import { t } from '@rivr/i18n';
import type { ReactNode } from 'react';
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
  /** The footer block: address, licence, links. */
  footer?: ReactNode;
  onNavigate?: Navigate | undefined;
}

/**
 * The public website frame: header with the club name and links, the page's blocks, and the
 * footer. Astro pages render it inside `body` and add only document elements around it.
 */
export function WebShell({ children, links, homeHref = '/', footer, onNavigate }: WebShellProps) {
  return (
    <div className="flex min-h-dvh flex-col bg-surface text-content">
      <header className="border-b border-hairline">
        {/* On a phone the links wrap under the wordmark rather than widening the page. */}
        <div className="mx-auto flex min-h-header max-w-console flex-wrap items-center justify-between gap-x-6 px-6 py-1">
          <a href={homeHref} onClick={(event) => routeClick(event, homeHref, onNavigate)} className="flex rounded-sm">
            <Wordmark />
          </a>
          <nav aria-label={t('ui.web.navigation')}>
            <ul className="flex flex-wrap items-center gap-x-6">
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
        </div>
      </header>
      <main className="flex-1">{children}</main>
      {footer ? (
        <footer className="border-t border-hairline">
          <div className="mx-auto max-w-console px-6 py-8">{footer}</div>
        </footer>
      ) : null}
    </div>
  );
}
