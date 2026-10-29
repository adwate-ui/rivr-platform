import { t } from '@rivr/i18n';
import type { ReactNode } from 'react';
import { BrandIcon, BRAND_ICON_NAMES, type BrandIconName } from '../BrandIcon/BrandIcon.tsx';
import { Button } from '../Button/Button.tsx';
import { Icon } from '../Icon/Icon.tsx';
import { routeClick, type Navigate } from '../internal/navigation.ts';
import { Wordmark } from '../Wordmark/Wordmark.tsx';

export interface WebShellLink {
  /** Already translated. */
  label: string;
  href: string;
}

/** A way to reach the club on the top bar: its mark, and its words for a screen reader, or shown beside it (the number). */
export interface WebShellContact {
  /** Already translated: `WhatsApp`, `+91 90000 00000`. */
  label: string;
  href: string;
  icon: 'phone' | 'mail' | BrandIconName;
  /** Shows the words beside the mark, as the phone number is; otherwise the mark alone, named by the words. */
  showsLabel?: boolean;
}

const isBrand = (icon: WebShellContact['icon']): icon is BrandIconName => BRAND_ICON_NAMES.some((name) => name === icon);

export interface WebShellProps {
  /** The page's website blocks. */
  children: ReactNode;
  links: readonly WebShellLink[];
  homeHref?: string;
  /** The header's one action, outlined: `Reserve a seat` (#441). */
  action?: { readonly label: string; readonly href: string } | undefined;
  /**
   * The thin bar above the header (#616): how to reach the club on the left, each as its icon (the phone with its number
   * beside it), and the member app on the right. These leave the website, so they never go through `onNavigate`.
   */
  topBar?: { readonly links: readonly WebShellContact[]; readonly app?: WebShellLink | undefined } | undefined;
  /** The footer block: address, licence, links. */
  footer?: ReactNode;
  /** What follows the page and footer, such as the cookie banner. */
  after?: ReactNode;
  onNavigate?: Navigate | undefined;
}

const TOP_LINK = 'flex min-h-touch min-w-touch items-center justify-center gap-2 whitespace-nowrap font-text text-12 text-content-muted transition-colors hover:text-content';

/** The bar above the header: the club's contacts on the left, the member app on the right; on a phone it scrolls sideways. */
function TopBar({ links, app }: NonNullable<WebShellProps['topBar']>) {
  return (
    <div className="border-b border-hairline bg-surface">
      <div className="mx-auto flex max-w-console items-center justify-between gap-x-6 overflow-x-auto px-6">
        <ul aria-label={t('ui.web.contact')} className="flex items-center gap-x-1">
          {links.map((link) => (
            <li key={link.href}>
              <a href={link.href} aria-label={link.showsLabel ? undefined : link.label} className={TOP_LINK}>
                {isBrand(link.icon) ? <BrandIcon name={link.icon} size="sm" /> : <Icon name={link.icon} size="sm" />}
                {link.showsLabel ? link.label : null}
              </a>
            </li>
          ))}
        </ul>
        {app ? <a href={app.href} className={TOP_LINK}>{app.label}</a> : null}
      </div>
    </div>
  );
}

/**
 * The public website frame: a header that stays at the top on a wide screen, with the club name, its links and one action,
 * the page's blocks in their bands (decision 0118), and the footer. Astro pages render it inside `body` and add only document elements around it.
 */
export function WebShell({ children, links, homeHref = '/', action, topBar, footer, after, onNavigate }: WebShellProps) {
  return (
    <div className="flex min-h-dvh flex-col bg-surface text-content">
      {topBar ? <TopBar links={topBar.links} app={topBar.app} /> : null}
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
          {action ? <Button variant="secondary" href={action.href}>{action.label}</Button> : null}
        </div>
      </header>
      <main className="flex-1">{children}</main>
      {footer ? (
        <footer className="border-t border-hairline bg-raised">
          <div className="mx-auto max-w-console px-6 py-12">{footer}</div>
        </footer>
      ) : null}
      {after}
    </div>
  );
}
