import { useAuthStatus, useControlState, useFeature, useMember } from '@rivr/db';
import { KillSwitchBanner, PlayerShell, type BottomNavItem, type FeatureAccess, type PlayerTab } from '@rivr/ui';
import { Navigate, useNavigate, useRouterState } from '@tanstack/react-router';
import type { ReactNode } from 'react';

// Home, Balance and Rewards always show as tabs; the features inside them are gated one by one.
const ALWAYS: FeatureAccess = { state: 'enabled' };

const TAB_FOR_PATH: Readonly<Record<string, PlayerTab>> = {
  '/': 'home',
  '/sessions': 'sessions',
  '/balance': 'balance',
  '/rewards': 'rewards',
  '/learn': 'learn',
};

/**
 * The player app's frame for a signed-in member: tabs gated by tier, the member's initial (which
 * opens Profile), the kill-switch banner and navigation. Nobody signed in goes to sign-in.
 */
export function Frame({ children }: { children: ReactNode }) {
  const authStatus = useAuthStatus();
  const member = useMember();
  const sessions = useFeature('sessions.history');
  const learn = useFeature('learn.library');
  const { isVenueFrozen } = useControlState();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  if (authStatus === 'signed-out') return <Navigate to="/sign-in" replace />;
  // Signed in with a number that is not a member yet: join first.
  if (member.isSuccess && member.data === null) return <Navigate to="/sign-up" replace />;
  const tabs: BottomNavItem[] = [
    { tab: 'home', href: '/', access: ALWAYS },
    { tab: 'sessions', href: '/sessions', access: sessions },
    { tab: 'balance', href: '/balance', access: ALWAYS },
    { tab: 'rewards', href: '/rewards', access: ALWAYS },
    { tab: 'learn', href: '/learn', access: learn },
  ];
  return (
    <PlayerShell
      tabs={tabs}
      currentTab={TAB_FOR_PATH[pathname]}
      memberInitial={member.data?.initial}
      profileHref="/profile"
      onNavigate={(href) => void navigate({ href })}
      banner={isVenueFrozen ? <KillSwitchBanner audience="member" /> : null}
    >
      {children}
    </PlayerShell>
  );
}
