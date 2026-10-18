import { formatList, useT } from '@rivr/i18n';
import { useId } from 'react';
import type { FeatureAccess } from '../FeatureGate/FeatureGate.tsx';
import { Icon } from '../Icon/Icon.tsx';
import { cx } from '../internal/classes.ts';
import { routeClick, type Navigate } from '../internal/navigation.ts';

/** The five player app tabs, in order. Profile sits behind the member's initial instead. */
export type PlayerTab = 'home' | 'sessions' | 'balance' | 'rewards' | 'learn';

export interface BottomNavItem {
  tab: PlayerTab;
  href: string;
  /** From `useFeature`: a hidden tab is left out, a locked tab shows a lock and names the tiers. */
  access: FeatureAccess;
}

export interface BottomNavProps {
  items: readonly BottomNavItem[];
  current?: PlayerTab | undefined;
  onNavigate?: Navigate | undefined;
}

/** The player app's tab bar. Tabs a member's tier lacks are hidden or locked from the same source as FeatureGate. */
export function BottomNav({ items, current, onNavigate }: BottomNavProps) {
  const t = useT();
  const visible = items.filter((item) => item.access.state !== 'hidden');
  return (
    <nav aria-label={t('ui.playerTabs.label')} className="border-t border-hairline bg-raised">
      <ul className="flex h-bottom-nav">
        {visible.map((item) => (
          <li key={item.tab} className="flex min-w-0 flex-1">
            <TabLink item={item} isCurrent={item.tab === current} onNavigate={onNavigate} />
          </li>
        ))}
      </ul>
    </nav>
  );
}

interface TabLinkProps {
  item: BottomNavItem;
  isCurrent: boolean;
  onNavigate: Navigate | undefined;
}

function TabLink({ item, isCurrent, onNavigate }: TabLinkProps) {
  const t = useT();
  const lockedId = useId();
  const tiers = item.access.state === 'locked' ? item.access.tiers : null;
  return (
    <>
      <a
        href={item.href}
        aria-current={isCurrent ? 'page' : undefined}
        aria-describedby={tiers ? lockedId : undefined}
        onClick={(event) => routeClick(event, item.href, onNavigate)}
        className={cx(
          'flex min-h-touch w-full flex-col items-center justify-center gap-1 font-text text-12 transition-colors',
          isCurrent ? 'font-medium text-content' : 'text-content-muted',
        )}
      >
        <Icon name={item.tab} />
        <span className="flex items-center gap-1">
          {t(`ui.playerTabs.${item.tab}`)}
          {tiers ? <Icon name="lock" size="sm" /> : null}
        </span>
      </a>
      {tiers ? (
        <span id={lockedId} className="sr-only">
          {t('common.featureLocked', { tiers: formatList(tiers) })}
        </span>
      ) : null}
    </>
  );
}
