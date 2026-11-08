import { TAB_FEATURES } from '@rivr/contracts/features';
import { returnSearchFrom, type ReturnSearch } from '@rivr/contracts/returnPath';
import { useAuthStatus, useFeature, useKycImageUrl, useKycRecord, useMember, type AuthStatus, type KycRecord } from '@rivr/db';
import { t } from '@rivr/i18n';
import { InstallOffer, PlayerShell, Screen, Stack, useIsOnline, type BottomNavItem, type FeatureAccess, type PlayerTab } from '@rivr/ui';
import { Navigate, useNavigate, useRouterState } from '@tanstack/react-router';
import { useState, type ReactNode } from 'react';
import { useInstallOffer } from '../install.ts';
import { BonusToasts } from './BonusToasts.tsx';
import { FrameBanners } from './FrameBanners.tsx';

// Tonight, Card and Rewards always show as tabs; the features inside them are gated one by one (decision 0320).
const ALWAYS: FeatureAccess = { state: 'enabled' };

const TAB_FOR_PATH: Readonly<Record<string, PlayerTab>> = {
  '/': 'home',
  '/sessions': 'sessions',
  '/card': 'card',
  '/rewards': 'rewards',
};

// Pushed screens with their own way back hide the tabs (decision 0320): Order, Profile and House rules.
const PUSHED = ['/fnb', '/profile', '/profile/rules'];

/** The tab a path sits under: a session's detail is under Sessions. */
function tabOf(pathname: string): PlayerTab | undefined {
  return TAB_FOR_PATH[pathname] ?? (pathname.startsWith('/sessions/') ? 'sessions' : undefined);
}

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

/** Whether the check lets the member into the app: verified, or their selfie is in while the club checks at the desk. */
const isLetIn = (kyc: KycRecord | null | undefined) => kyc?.status === 'verified' || (kyc?.status === 'started' && kyc.isAtTheClub);

/**
 * A member's screens once their identity check is verified (#632), or once their selfie let them in to be checked at the
 * club (decision 0502): the server still keeps play for the desk's check. Until then they see only its steps: a member whose
 * check is not verified goes to /kyc, and nothing shows while it is read, or the way to try again if it cannot be.
 */
function KycGate({ isMember, children }: { isMember: boolean; children: ReactNode }) {
  const kyc = useKycRecord();
  const isOnline = useIsOnline();
  if (isLetIn(kyc.data)) return children;
  if (isMember && kyc.isSuccess) return <Navigate to="/kyc" replace />;
  // Offline with nothing kept of the check, it cannot be read, so it says so rather than loading for ever (F-053).
  if (!isOnline || kyc.fetchStatus === 'paused') {
    return <Screen title={t('player.alerts.offlineTitle')} status="error" errorText={t('player.alerts.offlineGate')} onRetry={() => void kyc.refetch()} />;
  }
  return <Screen title={t('player.kyc.title')} status={kyc.isError ? 'error' : 'loading'} loadingLook="skeleton" onRetry={() => void kyc.refetch()} />;
}

/**
 * The member's selfie in the header's circle, as on Profile; their initial until it comes (the owner, 9 Nov). A member is
 * given their own selfie once verified (decision 0300), so none is asked for before.
 */
function useHeaderPhoto(): string | undefined {
  const kyc = useKycRecord().data;
  return useKycImageUrl(kyc?.status === 'verified' ? kyc.photoPath : null).data ?? undefined;
}

/**
 * The player app's frame for a signed-in member (decision 0320): Tonight, Sessions, Card and Rewards as tabs, gated by
 * tier; the member's photo or initial top right on a tab screen, which opens Profile; pushed screens (Order, Profile, House rules)
 * without the tabs; and on Tonight the offer to install the app (#16). The club's state (paused, offline) is a banner at
 * the top: Tonight's own, or the frame's on every other screen. Nobody signed in goes to sign-in, and back to this screen once signed in. Until their identity check is
 * verified, a member sees only its steps (#632).
 */
export function Frame({ children }: { children: ReactNode }) {
  const authStatus = useAuthStatus();
  const member = useMember();
  const photo = useHeaderPhoto();
  const sessions = useFeature(TAB_FEATURES.sessions);
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
    { tab: 'card', href: '/card', access: ALWAYS },
    { tab: 'rewards', href: '/rewards', access: ALWAYS },
  ];
  const currentTab = tabOf(pathname);
  return (
    <PlayerShell tabs={tabs} currentTab={currentTab} onNavigate={(href) => void navigate({ href })}
      avatar={TAB_FOR_PATH[pathname] === undefined ? undefined : { initial: member.data?.initial, photo, href: '/profile' }}
      isTabBarHidden={PUSHED.includes(pathname)} isFullBleed={pathname === '/'}>
      {pathname === '/' && offer.kind ? <InstallOffer kind={offer.kind} onInstall={offer.install} onDismiss={offer.dismiss} /> : null}
      {member.data ? <BonusToasts /> : null}
      {/* A banner keeps 8 px from the screen's header under it; the column grows so a screen can centre in it (Not found). */}
      <Stack gap={2} grow>
        {pathname === '/' ? null : <FrameBanners />}
        <KycGate isMember={Boolean(member.data)}>{children}</KycGate>
      </Stack>
    </PlayerShell>
  );
}
