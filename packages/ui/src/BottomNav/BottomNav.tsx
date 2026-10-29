import { t } from '@rivr/i18n';
import { useId } from 'react';
import type { FeatureAccess } from '../FeatureGate/FeatureGate.tsx';
import { Icon } from '../Icon/Icon.tsx';
import { lockedLine } from '../LockedNotice/LockedNotice.tsx';
import { cx } from '../internal/classes.ts';
import { routeClick, type Navigate } from '../internal/navigation.ts';

/**
 * The player app's tabs. Profile sits behind the member's initial instead. The Menu (#635) took Balance's place,
 * which is hidden (#627).
 */
export type PlayerTab = 'home' | 'sessions' | 'food' | 'balance' | 'rewards' | 'learn';

export interface BottomNavItem {
  tab: PlayerTab;
  href: string;
  /** From `useFeature`: a hidden tab is left out, a locked tab shows a lock and names the tiers, or says none is the way in. */
  access: FeatureAccess;
}

export interface BottomNavProps {
  items: readonly BottomNavItem[];
  current?: PlayerTab | undefined;
  onNavigate?: Navigate | undefined;
}

/** The player app's tab bar. Tabs a member's tier lacks are hidden or locked from the same source as FeatureGate. */
export function BottomNav({ items, current, onNavigate }: BottomNavProps) {
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
          {lockedLine(tiers)}
        </span>
      ) : null}
    </>
  );
}
