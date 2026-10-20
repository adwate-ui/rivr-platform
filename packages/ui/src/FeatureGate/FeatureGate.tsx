import type { ReactNode } from 'react';
import { LockedNotice } from '../LockedNotice/LockedNotice.tsx';

/**
 * Whether the signed-in member may use a feature, as `useFeature(key)` in @rivr/db returns it.
 * Defined here because @rivr/ui may not import @rivr/db; the two shapes match structurally
 * (docs/decisions/0010). `locked` names the tiers that have it, or none when no tier is the way in (taken from this member by an override, #353, or on no tier); `hidden` shows nothing.
 */
export type FeatureAccess = { state: 'enabled' } | { state: 'locked'; tiers: readonly string[] } | { state: 'hidden' };

export interface FeatureGateProps {
  access: FeatureAccess;
  children: ReactNode;
}

/** Renders a tier-gated feature, the one-line locked notice in its place, or nothing. */
export function FeatureGate({ access, children }: FeatureGateProps) {
  switch (access.state) {
    case 'enabled':
      return <>{children}</>;
    case 'locked':
      return <LockedNotice tiers={access.tiers} />;
    case 'hidden':
      return null;
  }
}
