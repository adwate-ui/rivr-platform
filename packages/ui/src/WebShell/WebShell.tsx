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

const TOP_LINK_LOOK = 'min-h-touch min-w-touch items-center justify-center gap-2 whitespace-nowrap font-text text-12 text-content-muted transition-colors hover:text-content';
const TOP_LINK = `flex ${TOP_LINK_LOOK}`;

/**
 * The bar above the header: the club's contacts on the left, the member app on the right from a tablet up (on a phone it
 * leads the header's links, UI polish audit A-25); on a phone the contacts scroll sideways.
 */
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
        {app ? <a href={app.href} className={`hidden tablet:flex ${TOP_LINK_LOOK}`}>{app.label}</a> : null}
      </div>
    </div>
  );
}

const SITE_LINK = 'flex min-h-touch items-center whitespace-nowrap font-text text-14 text-content-muted transition-colors hover:text-content';

/**
 * The header's links: in a row from a tablet up; on a phone behind Menu, the same list opening under the header (W-03),
 * led there by the member app (the top bar has it from a tablet up, A-25) and ended by the header's action, which has no
 * room beside the wordmark and Menu. Menu is a disclosure, so it works without JavaScript: the list follows it and shows
 * while it is open (peer-open).
 */
function SiteLinks({ links, app, action, onNavigate }: {
  links: readonly WebShellLink[]; app: WebShellLink | undefined; action: WebShellProps['action']; onNavigate: Navigate | undefined;
}) {
  return (
    <nav aria-label={t('ui.web.navigation')}>
      <details className="group peer tablet:hidden">
        <summary className="flex min-h-touch min-w-touch cursor-pointer items-center justify-center gap-2 font-text text-14 font-medium text-content">
          <span className="flex group-open:hidden"><Icon name="menu" size="sm" /></span>
          <span className="hidden group-open:flex"><Icon name="close" size="sm" /></span>
          {t('ui.web.menu')}
        </summary>
      </details>
      <ul className={'absolute inset-x-0 top-full z-nav hidden flex-col border-b border-hairline bg-raised px-6 py-2 peer-open:flex '
        + 'tablet:static tablet:flex tablet:flex-row tablet:flex-wrap tablet:items-center tablet:gap-x-6 tablet:border-0 tablet:p-0'}>
        {app ? (
          <li className="tablet:hidden">
            <a href={app.href} className={SITE_LINK}>{app.label}</a>
          </li>
        ) : null}
        {links.map((link) => (
          <li key={link.href}>
            <a href={link.href} onClick={(event) => routeClick(event, link.href, onNavigate)} className={SITE_LINK}>
              {link.label}
            </a>
          </li>
        ))}
        {action ? (
          <li className="py-2 tablet:hidden">
            <Button variant="secondary" href={action.href}>{action.label}</Button>
          </li>
        ) : null}
      </ul>
    </nav>
  );
}

/**
 * The public website frame: a header that stays at the top on a wide screen, with the club name, its links and one action,
 * the page's blocks in their bands (decision 0118), and the footer. Astro pages render it inside `body` and add only document elements around it.
 */
export function WebShell({ children, links, homeHref = '/', action, topBar, footer, after, onNavigate }: WebShellProps) {
  return (
    // data-shell: from 1180 px the page scrolls a focused control clear of the header (styles.css, WCAG 2.4.11).
    <div data-shell="web" className="flex min-h-dvh flex-col bg-surface text-content">
      {topBar ? <TopBar links={topBar.links} app={topBar.app} /> : null}
      <header className="relative border-b border-hairline bg-raised tablet:sticky tablet:top-0 tablet:z-nav">
        {/* On a phone Menu sits beside the wordmark, its list (with the action) opening under the header, rather than widening the page. */}
        <div className="mx-auto flex min-h-header max-w-console flex-wrap items-center justify-between gap-x-3 px-6 py-1 tablet:gap-x-6">
          <a href={homeHref} onClick={(event) => routeClick(event, homeHref, onNavigate)} className="me-auto flex rounded-sm tablet:me-0">
            <Wordmark />
          </a>
          <SiteLinks links={links} app={topBar?.app} action={action} onNavigate={onNavigate} />
          {action ? <div className="hidden tablet:flex"><Button variant="secondary" href={action.href}>{action.label}</Button></div> : null}
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
