import { TAB_FEATURES } from '@rivr/contracts/features';
import { returnSearchFrom, type ReturnSearch } from '@rivr/contracts/returnPath';
import { useAuthStatus, useControlState, useFeature, useMember, type AuthStatus } from '@rivr/db';
import { InstallOffer, KillSwitchBanner, OfflineBanner, PlayerShell, type BottomNavItem, type FeatureAccess, type PlayerTab } from '@rivr/ui';
import { Navigate, useNavigate, useRouterState } from '@tanstack/react-router';
import { useState, type ReactNode } from 'react';
import { useInstallOffer } from '../install.ts';

// Home and Rewards always show as tabs; the features inside them are gated one by one. Balance is hidden (#627).
const ALWAYS: FeatureAccess = { state: 'enabled' };

const TAB_FOR_PATH: Readonly<Record<string, PlayerTab>> = {
  '/': 'home',
  '/sessions': 'sessions',
  '/rewards': 'rewards',
  '/learn': 'learn',
};

/**
 * Where sign-in, and sign-up after it, return to (#233): the screen this frame shows, not the address
 * it is already leaving for. Sign-in returns there only for a visitor who arrived signed out, such as
 * by a link from the website; someone who signs out here starts afresh on Tonight.
 */
function useReturnSearch(authStatus: AuthStatus): { toSignIn: ReturnSearch; toSignUp: ReturnSearch } {
  const [signedInHere, setSignedInHere] = useState(false);
  if (authStatus === 'signed-in' && !signedInHere) setSignedInHere(true);
  const shown = useRouterState({ select: (state) => state.matches.at(-1)?.pathname ?? '/' });
  const next = returnSearchFrom({ next: shown === '/' ? undefined : shown });
  return { toSignIn: signedInHere ? returnSearchFrom({}) : next, toSignUp: next };
}

/**
 * The player app's frame for a signed-in member: tabs gated by tier, the member's initial (which
 * opens Profile), the kill-switch or offline banner and navigation, and on Tonight the offer to
 * install the app (#16). Nobody signed in goes to sign-in, and back to this screen once signed in.
 */
export function Frame({ children }: { children: ReactNode }) {
  const authStatus = useAuthStatus();
  const member = useMember();
  const sessions = useFeature(TAB_FEATURES.sessions);
  const learn = useFeature(TAB_FEATURES.learn);
  const { isVenueFrozen } = useControlState();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const { toSignIn, toSignUp } = useReturnSearch(authStatus);
  const offer = useInstallOffer(Boolean(member.data));
  if (authStatus === 'signed-out') return <Navigate to="/sign-in" search={toSignIn} replace />;
  // Signed in with a number that is not a member yet: join first.
  if (member.isSuccess && member.data === null) return <Navigate to="/sign-up" search={toSignUp} replace />;
  const tabs: BottomNavItem[] = [
    { tab: 'home', href: '/', access: ALWAYS },
    { tab: 'sessions', href: '/sessions', access: sessions },
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
      banner={isVenueFrozen ? <KillSwitchBanner audience="member" /> : <OfflineBanner />}
    >
      {pathname === '/' && offer.kind ? <InstallOffer kind={offer.kind} onInstall={offer.install} onDismiss={offer.dismiss} /> : null}
      {children}
    </PlayerShell>
  );
}
